#!/usr/bin/env node
/**
 * Chronicle Aurora — 重置模板设置（全局重置 ①）
 *
 * 将 data/ 下的模板设置文件重置为各 schema 的 default 值（即「我们目前的配置」）：
 *   - data/site.yml          ← template-settings + post-page 两个 schema 的树默认合并
 *   - data/profile.yml       ← profile schema 默认
 *   - data/friends.yml       ← friends schema 默认
 *   - data/collections.yml   ← collections schema 默认
 *   - data/background/background.yml ← 背景 meta 默认（含 baseColorLight/Dark）
 *
 * 使用 yaml Document API（keepSourceTokens）只更新被重置的路径，保留手写注释与未涉及键。
 *
 * 用法: node scripts/reset-site.mjs [--dry-run]
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import YAML from 'yaml'
import { REPO_ROOT, buildSchemaDefaults, readSchema, BACKGROUND_META_DEFAULTS } from './lib/schema-defaults.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

const SITE_SCHEMAS = [
  { schemaId: 'chronicle:template-settings', schemaPath: 'packages/template-astro/schemas/template-settings.schema.json', file: 'data/site.yml' },
  { schemaId: 'chronicle:post-page', schemaPath: 'packages/template-astro/schemas/post-page.schema.json', file: 'data/site.yml' },
  { schemaId: 'chronicle:profile', schemaPath: 'packages/template-astro/schemas/profile.schema.json', file: 'data/profile.yml' },
  { schemaId: 'chronicle:friends', schemaPath: 'packages/template-astro/schemas/friends.schema.json', file: 'data/friends.yml' },
  { schemaId: 'chronicle:collections', schemaPath: 'packages/template-astro/schemas/collections.schema.json', file: 'data/collections.yml' },
].filter(Boolean)

// 背景 meta 需要保留的注释结构：按已知键顺序生成（保留当前文件注释最稳妥的方式是
// Document API setIn——但 background.yml 是纯 meta 文件，直接重建也 OK；为保留注释，
// 我们读取现有文件，把 meta 键 setIn 回去。

function resolveRepoPath(rel) { return path.join(REPO_ROOT, rel) }

function readText(rel) {
  const abs = resolveRepoPath(rel)
  return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf-8') : ''
}

function writeText(rel, content) {
  const abs = resolveRepoPath(rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content, 'utf-8')
}

/** Document API 增量合并：只 setIn payload 涉及的路径，保留注释与其他键 */
function applyPayload(doc, payload, prefix = []) {
  for (const [k, v] of Object.entries(payload || {})) {
    const p = [...prefix, k]
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (doc.getIn(p) === undefined || doc.getIn(p) === null) doc.setIn(p, {})
      applyPayload(doc, v, p)
    } else {
      doc.setIn(p, v)
    }
  }
}

function log(...args) { console.log('[reset-site]', ...args) }

async function main() {
  if (DRY_RUN) log('DRY RUN — 不写入文件')

  // ── 1. site.yml：template-settings + post-page 树默认合并 ──
  const siteDefaults = {}
  for (const s of SITE_SCHEMAS.filter(x => x.file === 'data/site.yml')) {
    const sch = readSchema(s.schemaPath)
    Object.assign(siteDefaults, buildSchemaDefaults(sch))
  }
  log('site.yml 重置键:', Object.keys(siteDefaults).join(', '))

  // 排除不入 site.yml 的字段：
  //   - x-persist:false（UI 虚拟：background / backgroundMeta / avatar）
  //   - x-file（跨文件持久化：baseColorLight/Dark → background.yml，background.yml 单独重置）
  //   - $ 前缀虚拟键（$about_edit 等）
  const stripVirtual = (defaults, schema) => {
    const out = {}
    for (const [k, v] of Object.entries(defaults)) {
      const prop = schema?.properties?.[k]
      if (k.startsWith('$')) continue
      if (prop?.['x-persist'] === false) continue
      if (prop?.['x-file']) continue
      if (prop?.['x-widget'] === 'fieldset' && prop.properties) {
        out[k] = stripVirtual(v, prop)
      } else {
        out[k] = v
      }
    }
    return out
  }
  const tsSchema = readSchema('packages/template-astro/schemas/template-settings.schema.json')
  const ppSchema = readSchema('packages/template-astro/schemas/post-page.schema.json')
  // 对 site.yml 顶层用 template-settings schema 递归（覆盖 homepage/appearance/search 块内）
  const siteClean = stripVirtual(siteDefaults, tsSchema)
  siteClean.post = stripVirtual(siteDefaults.post || {}, ppSchema.properties?.post || {})

  const siteExisting = readText('data/site.yml')
  const siteDoc = siteExisting ? YAML.parseDocument(siteExisting, { keepSourceTokens: true }) : new YAML.Document()
  applyPayload(siteDoc, siteClean)
  if (!DRY_RUN) writeText('data/site.yml', siteDoc.toString({ lineWidth: -1 }))
  log('site.yml 已重置' + (DRY_RUN ? '（dry-run）' : ''))

  // ── 2. profile / friends / collections（同样剔除虚拟键）──
  for (const s of SITE_SCHEMAS.filter(x => x.file !== 'data/site.yml')) {
    const sch = readSchema(s.schemaPath)
    const defaults = stripVirtual(buildSchemaDefaults(sch), sch)
    const existing = readText(s.file)
    const doc = existing ? YAML.parseDocument(existing, { keepSourceTokens: true }) : new YAML.Document()
    // array schema（collections）→ 整体替换为默认数组
    if (sch.type === 'array') {
      doc.contents = YAML.parseDocument(YAML.stringify(defaults, { lineWidth: -1 })).contents
    } else {
      applyPayload(doc, defaults)
    }
    if (!DRY_RUN) writeText(s.file, doc.toString({ lineWidth: -1 }))
    log(s.file + ' 已重置' + (DRY_RUN ? '（dry-run）' : ''))
  }

  // ── 3. background.yml：背景 meta 重置（含 baseColorLight/Dark）──
  const bgFile = 'data/background/background.yml'
  const bgExisting = readText(bgFile)
  const bgDoc = bgExisting ? YAML.parseDocument(bgExisting, { keepSourceTokens: true }) : new YAML.Document()
  applyPayload(bgDoc, BACKGROUND_META_DEFAULTS)
  if (!DRY_RUN) writeText(bgFile, bgDoc.toString({ lineWidth: -1 }))
  log(bgFile + ' 已重置' + (DRY_RUN ? '（dry-run）' : ''))

  log('完成' + (DRY_RUN ? '（dry-run，未写入）' : ' — 可 git diff 检查后提交'))
}

main().catch((e) => { console.error('[reset-site] 失败:', e); process.exit(1) })
