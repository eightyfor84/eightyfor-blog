#!/usr/bin/env node
/**
 * Chronicle Aurora — 将 schema 的 default 字段重新制定为当前生效值
 *
 * 读取 data/ 下各 yml 的现值，按路径回填对应 schema JSON 的 `default`：
 *   - template-settings.schema.json ← data/site.yml（homepage/appearance/search 块 + features/analytics 顶层）
 *   - post-page.schema.json         ← data/site.yml 的 post 子树
 *   - profile.schema.json           ← data/profile.yml
 *   - friends.schema.json           ← data/friends.yml
 *   - collections.schema.json       ← data/collections.yml
 *   - background.yml 的 meta 默认值（脚本内常量）← data/background/background.yml
 *
 * 规则：
 *   - 只改 `default` 字段，保留 x-* 扩展、title 等全部其他结构
 *   - x-persist:false（UI 虚拟）字段跳过，不设 default
 *   - yml 缺失的键保持原 schema default
 *
 * 用法: node scripts/sync-schema-defaults.mjs [--dry-run]
 */

import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { REPO_ROOT } from './lib/schema-defaults.mjs'

const DRY_RUN = process.argv.includes('--dry-run')

const SCHEMA_MAP = [
  { schema: 'packages/template-astro/schemas/template-settings.schema.json', file: 'data/site.yml', map: (site) => ({ ...site, post: undefined }) },
  { schema: 'packages/template-astro/schemas/post-page.schema.json', file: 'data/site.yml', map: (site) => ({ post: site.post || {} }) },
  { schema: 'packages/template-astro/schemas/profile.schema.json', file: 'data/profile.yml' },
  { schema: 'packages/template-astro/schemas/friends.schema.json', file: 'data/friends.yml' },
  { schema: 'packages/template-astro/schemas/collections.schema.json', file: 'data/collections.yml' },
].filter(Boolean)

function log(...args) { console.log('[sync-defaults]', ...args) }

/**
 * 默认值覆盖规则（无论 yml 现值如何，重置后固定为这些值）：
 *   - 内容性字段 → 空值（用户填写）
 *   - 必填字段 → 无意义、无个人信息的占位文本（校验不失败、不泄露信息）
 *   - 服务地址 → 空（用户配置自己的实例）
 */
const EMPTY_OVERRIDES = {
  // 必填占位文本（无个人信息）
  'homepage.siteName': 'Chronicle Aurora',
  'homepage.siteDescription': 'Chronicle Aurora — a local-first, git-backed Jamstack blog.',
  'name': 'Author Name',
  // 内容性空值
  'bio': '',
  'location': '',
  'links': [],
  'cards': [],
  // 服务地址占位空（用户配置自己的 Waline）
  'post.comments.walineServerUrl': '',
}

/** 按路径回填 default：value 存在（非 undefined）时写入 schema 对应节点的 default */
function fillDefaults(schemaNode, value, path = []) {
  if (!schemaNode || typeof schemaNode !== 'object') return
  const props = schemaNode.properties
  if (!props || typeof props !== 'object' || value == null || typeof value !== 'object' || Array.isArray(value)) return
  for (const [key, prop] of Object.entries(props)) {
    const full = [...path, key].join('.')
    const val = value[key]
    // 空值化：命中 EMPTY_OVERRIDES 的字段强制空值
    if (full in EMPTY_OVERRIDES) {
      prop.default = JSON.parse(JSON.stringify(EMPTY_OVERRIDES[full]))
      continue
    }
    // x-site-flag（评论总开关等）：值在 site.yml 顶层为布尔，不应被子树对象覆盖——保留 schema 原有 default
    if (prop?.['x-site-flag'] === true) continue
    // 数组字段（friends.cards 等）：同步为现值数组（collections 是 schema 级数组容器，走 schema.default 分支）
    if (prop?.type === 'array') {
      if (val !== undefined && val !== null && Array.isArray(val)) {
        prop.default = JSON.parse(JSON.stringify(val))
      }
      continue
    }
    if (prop?.['x-persist'] === false) continue
    if (prop?.type === 'object' && prop.properties) {
      // 对象：递归，但仅在子属性有 default 时写（不强制嵌套空对象）
      if (val !== undefined && val !== null && typeof val === 'object' && !Array.isArray(val)) {
        fillDefaults(prop, val, [...path, key])
      }
    } else if (val !== undefined && val !== null) {
      prop.default = JSON.parse(JSON.stringify(val))
    }
  }
}

async function main() {
  if (DRY_RUN) log('DRY RUN — 不写入文件')

  // 预读各 yml 现值
  const ymlCache = {}
  for (const s of SCHEMA_MAP) {
    if (!ymlCache[s.file]) {
      const abs = path.join(REPO_ROOT, s.file)
      ymlCache[s.file] = fs.existsSync(abs) ? YAML.parse(fs.readFileSync(abs, 'utf-8')) : null
    }
  }

  for (const s of SCHEMA_MAP) {
    const schemaAbs = path.join(REPO_ROOT, s.schema)
    const schema = JSON.parse(fs.readFileSync(schemaAbs, 'utf-8'))
    const site = ymlCache['data/site.yml']
    let source = ymlCache[s.file]
    if (s.map) source = s.map(site)

    // collections：数组 schema → default 为空数组（内容性，用户自行添加合集）
    if (schema.type === 'array') {
      schema.default = []
    } else {
      fillDefaults(schema, source || {})
    }

    const out = JSON.stringify(schema, null, 2) + '\n'
    if (DRY_RUN) {
      log('将更新:', s.schema)
    } else {
      fs.writeFileSync(schemaAbs, out, 'utf-8')
      log('已更新:', s.schema)
    }
  }

  // background.yml meta 默认值（reset-site.mjs / useGlobalReset.ts 的常量来源）
  const bgAbs = path.join(REPO_ROOT, 'data/background/background.yml')
  const bg = fs.existsSync(bgAbs) ? YAML.parse(fs.readFileSync(bgAbs, 'utf-8')) : {}
  if (DRY_RUN) {
    log('背景 meta 默认将同步为:', JSON.stringify(bg))
  } else {
    // 同步到 reset-site.mjs 与 useGlobalReset.ts 的常量（简单文本替换——保持两处一致）
    const bgJson = JSON.stringify(bg, null, 2)
    for (const target of ['scripts/reset-site.mjs', 'packages/manager/src/composables/useGlobalReset.ts']) {
      // 不自动改代码常量（风险高）；仅提示手动同步
      log('提示: ' + target + ' 的 BACKGROUND_META_DEFAULTS 需同步为当前背景值（见上）')
    }
  }

  log('完成' + (DRY_RUN ? '（dry-run）' : ''))
}

main().catch((e) => { console.error('[sync-defaults] 失败:', e); process.exit(1) })
