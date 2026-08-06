#!/usr/bin/env node
/**
 * Chronicle Aurora — Legacy Data Migration
 *
 * Usage:
 *   node scripts/migrate-legacy.mjs data.tar.gz
 *
 * 1. Backs up data/ → data.bak/
 * 2. Extracts legacy archive
 * 3. Converts to Aurora format in-place in data/
 */

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, rmSync, copyFileSync, statSync } from 'node:fs'
import { join, parse, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const REPO = join(__dirname, '..')
const DATA = join(REPO, 'data')
const DATA_BAK = join(REPO, 'data.bak')
const TMP = join(REPO, '.migrate-tmp')

const tarball = process.argv[2]
if (!tarball || !existsSync(tarball)) {
  console.error('Usage: node scripts/migrate-legacy.mjs <data.tar.gz>')
  process.exit(1)
}

// ── Helpers ──────────────────────────────────────────────

function slugify(text) {
  return (text || 'untitled')
    .toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80)
}

function parseYaml(text) {
  const result = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^(?:-\s+)?(\w[\w-]*):\s*(.*)/)
    if (m) result[m[1]] = m[2].trim()
  }
  return result
}

function toYaml(obj, indent = '') {
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'object' && item !== null) {
        return `${indent}- ${toYaml(item, indent + '  ').trimStart()}`
      }
      return `${indent}- ${item}`
    }).join('\n')
  }
  if (typeof obj === 'object' && obj !== null) {
    return Object.entries(obj)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => {
        if (k.startsWith('_')) return ''
        if (typeof v === 'object') return `${indent}${k}:\n${toYaml(v, indent + '  ')}`
        // Only quote if contains newline or leading/trailing whitespace
        const sv = String(v)
        const needsQuote = sv.includes('\n') || sv !== sv.trim()
        const val = needsQuote ? `"${sv.replace(/"/g, '\\"')}"` : sv
        return `${indent}${k}: ${val}`
      }).filter(Boolean).join('\n')
  }
  return String(obj)
}

// ═══════════════════════════════════════════════════════════
// Step 1: Backup
// ═══════════════════════════════════════════════════════════

console.log('[migrate] 1/6 Backing up data/ → data.bak/')
if (existsSync(DATA_BAK)) rmSync(DATA_BAK, { recursive: true, force: true })
if (existsSync(DATA)) {
  copyFileSync ? null : null // cpSync is better
  execSync(`cp -r "${DATA}" "${DATA_BAK}"`)
}

// ═══════════════════════════════════════════════════════════
// Step 2: Extract legacy
// ═══════════════════════════════════════════════════════════

console.log('[migrate] 2/6 Extracting legacy archive')
if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })
execSync(`tar -xzf "${tarball}" -C "${TMP}"`)

// Find the extracted data directory
let legacyData = join(TMP, 'data')
if (!existsSync(legacyData)) {
  // Try one level deep
  const entries = readdirSync(TMP)
  for (const e of entries) {
    const candidate = join(TMP, e, 'data')
    if (existsSync(candidate)) { legacyData = candidate; break }
  }
}
if (!existsSync(legacyData)) {
  console.error('[migrate] Could not find data/ in archive. Found:')
  console.error(readdirSync(TMP))
  process.exit(1)
}

// ═══════════════════════════════════════════════════════════
// Step 3: Convert configs (JSON → YAML)
// ═══════════════════════════════════════════════════════════

console.log('[migrate] 3/6 Converting configs JSON → YAML')

// Clean up data/ (keep existing files not in legacy)
const configMap = {
  'settings.json': { dest: 'site.yml', transform: s => ({
    siteName: s.siteName || s.sitename || '',
    siteDescription: s.siteDescription || '',
    frontendTheme: s.frontendTheme || 'follow', frontendAccent: s.frontendAccent || '#2ea35f',
    frontendFont: s.frontendFont || 'sans', frontendLocale: s.frontendLocale || 'follow',
    searchSuggestions: s.searchSuggestions ?? false, relatedPosts: s.relatedPosts ?? false,
    collectionPage: s.collectionPage ?? true, aboutPage: s.aboutPage ?? true,
    friendsPage: s.friendsPage ?? true, traffic: s.traffic ?? true,
    rss: s.rss ?? true, sitemap: s.sitemap ?? false,
    gaMeasurementId: s.gaMeasurementId || '', icpNumber: s.icpNumber || '',
    homepageMode: s.homepageMode || 'split', singleColumnHomepage: s.singleColumnHomepage ?? false,
    cardVisibility: s.cardVisibility || {},
    comment: s.comment || {},
  })},
  'profile.json': { dest: 'profile.yml', transform: p => ({
    name: p.name || '', bio: p.bio || '', location: p.location || '',
    showProfileCard: p.showProfileCard ?? true,
    links: (p.links || []).map(l => ({ label: l.label || '', url: l.url || '' })),
  })},
  'friends.json': { dest: 'friends.yml', transform: f => ({
    globalStyle: f.globalStyle || null,
    cards: (f.cards || []).map(c => ({
      name: c.name || '', avatar: c.avatar || '', intro: c.intro || '',
      homeUrl: c.homeUrl || '', storyPostId: c.storyPostId || '',
    })),
  })},
  'collections.json': { dest: 'collections.yml', transform: c => {
    const arr = Array.isArray(c) ? c : (c.collections || [])
    return arr.map(col => ({
      name: col.name || '', description: col.description || '',
      cover: col.cover || '', slug: col.slug || slugify(col.name || ''), nodes: col.nodes || [],
    }))
  }},
}

for (const [src, { dest, transform }] of Object.entries(configMap)) {
  const srcPath = join(legacyData, src)
  const dstPath = join(DATA, dest)
  if (existsSync(srcPath)) {
    try {
      const json = JSON.parse(readFileSync(srcPath, 'utf-8'))
      const data = transform(json)
      const yml = typeof data === 'object' && !Array.isArray(data)
        ? `# Chronicle Aurora\n${toYaml(data)}`
        : `# Chronicle Aurora\n${toYaml({ collections: data })}`
      writeFileSync(dstPath, yml + '\n', 'utf-8')
      console.log(`  ${src} → ${dest}`)
    } catch (e) { console.error(`  FAILED ${src}:`, e.message) }
  }
}

// ═══════════════════════════════════════════════════════════
// Step 4: Migrate posts
// ═══════════════════════════════════════════════════════════

console.log('[migrate] 4/6 Migrating posts (UUID → slug)')

const legacyPosts = join(legacyData, 'posts')
const legacyIndex = join(legacyPosts, 'index.json')
const legacyIndexData = existsSync(legacyIndex)
  ? JSON.parse(readFileSync(legacyIndex, 'utf-8'))
  : []
const indexEntries = Array.isArray(legacyIndexData) ? legacyIndexData : Object.values(legacyIndexData)

const newPostsDir = join(DATA, 'posts')
if (existsSync(newPostsDir)) {
  // Keep existing posts, only add new ones from legacy
}
mkdirSync(newPostsDir, { recursive: true })

const newIndex = {}
let postCount = 0

for (const entry of indexEntries) {
  const uuid = entry.id
  if (!uuid) continue

  // Slug = UUID (keep existing UUID as identifier)
  const slug = entry.slug || uuid

  // Find content files
  const legacyPostDir = join(legacyPosts, uuid)
  if (!existsSync(legacyPostDir)) continue

  const contentFiles = readdirSync(legacyPostDir).filter(f => f.endsWith('-content.md') && !f.endsWith('.bak'))
  if (contentFiles.length === 0) continue

  const srcFile = join(legacyPostDir, contentFiles[0])
  let raw = readFileSync(srcFile, 'utf-8')

  // Parse frontmatter
  let fm = {}
  let body = raw
  if (raw.startsWith('---')) {
    const end = raw.indexOf('---', 3)
    if (end !== -1) {
      fm = parseYaml(raw.slice(3, end))
      body = raw.slice(end + 3).trim()
    }
  }

  // Fix status: modifying → draft
  let status = entry.status || 'draft'
  if (status === 'modifying') status = 'draft'

  // Replace upload/ URLs with asset:// protocol
  body = body.replace(/https?:\/\/[^)\s]*\/server\/data\/upload\/[^)\s]+/g, (url) => {
    const filename = basename(url.split('?')[0])
    return `asset://${filename}`
  })
  body = body.replace(/\/server\/data\/upload\/([^)\s]+)/g, (_, p) => {
    return `asset://${basename(p)}`
  })

  // Build new frontmatter
  const newFm = {
    title: entry.title || '',
    date: entry.date || new Date().toISOString(),
    tags: Array.isArray(entry.tags) ? entry.tags.join(', ') : (entry.tags || ''),
    author: entry.author || '',
    aiGenerated: entry.aiGenerated || false,
    font: entry.font || 'sans',
    status,
  }
  if (entry.summary) newFm.summary = entry.summary

  // Write index.md
  const destDir = join(newPostsDir, slug)
  mkdirSync(destDir, { recursive: true })
  const indexMd = `---\n${toYaml(newFm)}\n---\n\n${body}\n`
  writeFileSync(join(destDir, 'index.md'), indexMd, 'utf-8')

  // Copy attachments (images etc.) from legacy post dir
  for (const f of readdirSync(legacyPostDir)) {
    if (f.endsWith('-content.md') || f.endsWith('.bak') || f.endsWith('-draft.md')) continue
    copyFileSync(join(legacyPostDir, f), join(destDir, f))
  }

  // Build index entry
  newIndex[slug] = {
    title: entry.title || '', date: entry.date || '', tags: Array.isArray(entry.tags) ? entry.tags : [],
    status, summary: entry.summary || '', font: entry.font || 'sans',
    author: entry.author || '', aiGenerated: entry.aiGenerated || false,
    type: (fm.marp === true || fm.marp === 'true') ? 'slides' : 'article',
  }

  postCount++
}

// Write new index.json
writeFileSync(join(newPostsDir, 'index.json'), JSON.stringify(newIndex, null, 2) + '\n', 'utf-8')
console.log(`  ${postCount} posts migrated`)

// ═══════════════════════════════════════════════════════════
// Step 5: Migrate assets (upload/ → assets/)
// ═══════════════════════════════════════════════════════════

console.log('[migrate] 5/6 Migrating assets upload/ → assets/')

const legacyUpload = join(legacyData, 'upload')
const newAssets = join(DATA, 'assets')
mkdirSync(newAssets, { recursive: true })

if (existsSync(legacyUpload)) {
  let assetCount = 0
  function copyAssets(dir, base) {
    if (!existsSync(dir)) return
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === '.thumbs') continue
      const src = join(dir, entry.name)
      if (entry.isDirectory()) {
        copyAssets(src, base)
      } else {
        const dest = join(newAssets, entry.name)
        if (!existsSync(dest)) { copyFileSync(src, dest); assetCount++ }
      }
    }
  }
  copyAssets(legacyUpload, '')
  console.log(`  ${assetCount} assets migrated`)
}

// Handle about.md → __about__/index.md
const legacyAbout = join(legacyData, 'about.md')
const aboutDir = join(DATA, '__about__')
if (existsSync(legacyAbout)) {
  mkdirSync(aboutDir, { recursive: true })
  let aboutContent = readFileSync(legacyAbout, 'utf-8')
  // Replace upload URLs
  aboutContent = aboutContent.replace(/\/server\/data\/upload\/([^)\s]+)/g, (_, p) => `asset://${basename(p)}`)
  aboutContent = aboutContent.replace(/https?:\/\/[^)\s]*\/server\/data\/upload\/([^)\s]+)/g, (_, p) => `asset://${basename(p)}`)
  const aboutMd = `---\ntitle: About\ndate: ${new Date().toISOString().split('T')[0]}\nstatus: published\n---\n\n${aboutContent}\n`
  writeFileSync(join(aboutDir, 'index.md'), aboutMd, 'utf-8')
  console.log('  about.md → __about__/index.md')
}

// ═══════════════════════════════════════════════════════════
// Step 6: Cleanup
// ═══════════════════════════════════════════════════════════

console.log('[migrate] 6/6 Cleanup')

// Delete index.json (Aurora rebuilds on demand)
const indexFile = join(DATA, 'posts', 'index.json')
try { rmSync(indexFile); console.log('  Deleted posts/index.json (will be rebuilt)') } catch {}

// Delete legacy files we don't need
for (const file of ['security.json', 'settings.json', 'profile.json', 'friends.json', 'collections.json', '.schema-version']) {
  try { rmSync(join(DATA, file)); console.log(`  Deleted ${file}`) } catch {}
}

// Remove branding/ and manager-background/ (replaced by background/ + avatar/)
for (const dir of ['branding', 'manager-background', 'upload']) {
  try { rmSync(join(DATA, dir), { recursive: true, force: true }); console.log(`  Deleted ${dir}/`) } catch {}
}

// Clean up tmp
rmSync(TMP, { recursive: true, force: true })

console.log('\n✅ Migration complete!')
console.log(`   Backup: ${DATA_BAK}`)
console.log(`   Posts:  ${postCount}`)
