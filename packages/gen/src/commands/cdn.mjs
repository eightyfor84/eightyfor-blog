/**
 * Chronicle Gen — CDN Cache Management
 *
 * Aliyun CDN cache purge + generic URL pre-warming.
 * Callable via CLI or as a library from host/admin routes.
 *
 * CLI usage:
 *   npx chronicle-gen cdn purge https://example.com/file.png ...
 *   npx chronicle-gen cdn purge --type Directory https://example.com/dir/
 *   npx chronicle-gen cdn warm https://example.com/ https://example.com/page/
 *
 * Env vars:
 *   ALIYUN_ACCESS_KEY_ID      — Aliyun AccessKey ID
 *   ALIYUN_ACCESS_KEY_SECRET  — Aliyun AccessKey Secret
 *   CDN_API_ENDPOINT          — CDN API endpoint (default: https://cdn.aliyuncs.com/)
 *   CDN_ENABLED               — Set to 'true' to enable purge (default: disabled)
 */

import crypto from 'node:crypto';

// ── Helpers ──────────────────────────────────────────────────

function percentEncode(str) {
  return encodeURIComponent(str)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

// ── Aliyun CDN Purge ─────────────────────────────────────────

/**
 * Refresh (purge) specific URLs from Aliyun CDN cache.
 *
 * Uses Aliyun CDN RefreshObjectCaches API (2018-05-10 version).
 * Requires ALIYUN_ACCESS_KEY_ID and ALIYUN_ACCESS_KEY_SECRET env vars.
 *
 * @param {string[]} urls - URLs to purge from CDN cache
 * @param {object} [opts]
 * @param {'File'|'Directory'} [opts.type='File'] - Purge type
 * @param {string} [opts.accessKeyId] - Override env ALIYUN_ACCESS_KEY_ID
 * @param {string} [opts.accessKeySecret] - Override env ALIYUN_ACCESS_KEY_SECRET
 * @param {string} [opts.endpoint] - Override env CDN_API_ENDPOINT
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function purgeAliyunCdn(urls = [], opts = {}) {
  const accessKeyId = opts.accessKeyId || process.env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = opts.accessKeySecret || process.env.ALIYUN_ACCESS_KEY_SECRET || '';
  const endpoint = opts.endpoint || process.env.CDN_API_ENDPOINT || 'https://cdn.aliyuncs.com/';

  if (!accessKeyId || !accessKeySecret) {
    const msg = '[CDN] Missing ALIYUN_ACCESS_KEY_ID or ALIYUN_ACCESS_KEY_SECRET — skipping purge';
    console.warn(msg);
    return { success: false, message: msg };
  }

  if (!urls || urls.length === 0) {
    return { success: false, message: '[CDN] No URLs provided' };
  }

  try {
    const params = {
      Format: 'JSON',
      Version: '2018-05-10',
      AccessKeyId: accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: new Date().toISOString().replace(/\.\d{3}/, ''),
      SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(36).slice(2) + Date.now().toString(36),
      Action: 'RefreshObjectCaches',
      ObjectType: opts.type || 'File',
    };

    urls.forEach((u, i) => {
      params[`ObjectPath.${i + 1}`] = u;
    });

    // Build signature
    const keys = Object.keys(params).sort();
    const canonicalized = keys
      .map(k => `${percentEncode(k)}=${percentEncode(String(params[k]))}`)
      .join('&');
    const stringToSign = `GET&%2F&${percentEncode(canonicalized)}`;

    const hmac = crypto.createHmac('sha1', accessKeySecret + '&');
    hmac.update(stringToSign);
    const sign = hmac.digest('base64');

    const finalParams = { Signature: sign, ...params };
    const qs = Object.keys(finalParams)
      .map(k => `${percentEncode(k)}=${percentEncode(String(finalParams[k]))}`)
      .join('&');
    const apiUrl = `${endpoint}?${qs}`;

    const redacted = apiUrl.replace(/(AccessKeyId=)[^&]+/, '$1****');
    console.log('[CDN] Purge request:', redacted);

    const resp = await fetch(apiUrl, { method: 'GET' });
    const body = await resp.text();

    if (resp.ok) {
      console.log('[CDN] Purge accepted:', resp.status, body);
      return { success: true, message: body };
    }

    console.error('[CDN] Purge rejected:', resp.status, body);
    return { success: false, message: `HTTP ${resp.status}: ${body}` };
  } catch (e) {
    const msg = `[CDN] Purge error: ${e.message || e}`;
    console.error(msg);
    return { success: false, message: msg };
  }
}

// ── URL Pre-warming ───────────────────────────────────────────

/**
 * Pre-warm URLs by issuing GET requests (brings them into CDN edge cache).
 * Fires all requests concurrently and collects results.
 *
 * @param {string[]} urls - URLs to warm
 * @param {object} [opts]
 * @param {number} [opts.concurrency=5] - Max concurrent requests
 * @param {number} [opts.timeoutMs=10000] - Per-request timeout
 * @returns {Promise<{ success: boolean, results: Array<{ url: string, status: number|string }> }>}
 */
export async function warmUrls(urls = [], opts = {}) {
  const concurrency = opts.concurrency || 5;
  const timeoutMs = opts.timeoutMs || 10000;
  const unique = [...new Set((urls || []).map(u => String(u || '').trim()).filter(Boolean))];

  if (unique.length === 0) {
    return { success: true, results: [] };
  }

  const results = [];

  // Process in batches for controlled concurrency
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(
      batch.map(async (url) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const resp = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
          });
          clearTimeout(timer);
          // Drain body so connection recycles
          try { await resp.arrayBuffer(); } catch {}
          return { url, status: resp.status };
        } catch (e) {
          clearTimeout(timer);
          return { url, status: e.name === 'AbortError' ? 'timeout' : (e.message || 'error') };
        }
      })
    );

    for (const r of batchResults) {
      if (r.status === 'fulfilled') {
        results.push(r.value);
        if (typeof r.value.status === 'number' && r.value.status >= 200 && r.value.status < 400) {
          console.log('[Warm] OK', r.value.url, r.value.status);
        } else {
          console.warn('[Warm]', r.value.status, r.value.url);
        }
      } else {
        results.push({ url: '(unknown)', status: r.reason?.message || 'rejected' });
      }
    }
  }

  const allOk = results.every(r => typeof r.status === 'number' && r.status >= 200 && r.status < 400);
  return { success: allOk, results };
}

// ── CLI Handler ───────────────────────────────────────────────

export function cdnCommand(args = []) {
  const subCommand = args[0] || 'help';

  switch (subCommand) {
    case 'purge':
    case 'p': {
      const enableCdn = process.env.CDN_ENABLED === 'true';
      if (!enableCdn) {
        console.log('[CDN] CDN purge is disabled. Set CDN_ENABLED=true to enable.');
        return;
      }

      let type = 'File';
      let urls = [];

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--type' || args[i] === '-t') {
          const val = args[++i];
          if (val && (val.toLowerCase() === 'directory' || val.toLowerCase() === 'file')) {
            type = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
          }
        } else if (!args[i].startsWith('-')) {
          urls.push(args[i]);
        }
      }

      if (urls.length === 0) {
        console.error('[CDN] Usage: npx chronicle-gen cdn purge [--type File|Directory] <urls...>');
        process.exit(1);
      }

      purgeAliyunCdn(urls, { type }).then((result) => {
        if (!result.success) process.exit(1);
      });
      break;
    }

    case 'warm':
    case 'w': {
      let urls = [];
      let concurrency = 5;

      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--concurrency' || args[i] === '-c') {
          const val = Number(args[++i]);
          if (Number.isFinite(val) && val > 0) concurrency = val;
        } else if (!args[i].startsWith('-')) {
          urls.push(args[i]);
        }
      }

      if (urls.length === 0) {
        console.error('[CDN] Usage: npx chronicle-gen cdn warm [--concurrency 5] <urls...>');
        process.exit(1);
      }

      warmUrls(urls, { concurrency }).then((result) => {
        if (!result.success) process.exit(1);
      });
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default: {
      console.log(`Chronicle Gen — CDN Cache Management

Usage: npx chronicle-gen cdn <subcommand> [options] <urls...>

Subcommands:
  purge, p     Purge specific URLs from Aliyun CDN cache
  warm, w      Pre-warm URLs by fetching them (fill CDN edge cache)

Purge Options:
  --type, -t   Purge type: "File" (default) or "Directory"

Warm Options:
  --concurrency, -c  Max concurrent requests (default: 5)

Environment:
  CDN_ENABLED               Set to 'true' to enable CDN operations
  ALIYUN_ACCESS_KEY_ID      Aliyun AccessKey ID (for purge)
  ALIYUN_ACCESS_KEY_SECRET  Aliyun AccessKey Secret (for purge)
  CDN_API_ENDPOINT          API endpoint (default: https://cdn.aliyuncs.com/)

Examples:
  npx chronicle-gen cdn purge https://cdn.example.com/style.css
  npx chronicle-gen cdn purge --type Directory https://cdn.example.com/blog/
  npx chronicle-gen cdn warm https://blog.example.com/ https://blog.example.com/about/
`);
      break;
    }
  }
}
