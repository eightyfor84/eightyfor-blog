#!/usr/bin/env node
/**
 * Chronicle Aurora — 重置 CMS 配置（全局重置 ②）
 *
 * 将 .chronicle/workspace.json 重置为 system-settings schema 的 default 值。
 * workspace.json 是程序写入的 JSON（非手写），直接全量重建即可。
 *
 * 用法: node scripts/reset-cms.mjs [--dry-run]
 */

import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT, buildSchemaDefaults, readSchema } from './lib/schema-defaults.mjs'

const DRY_RUN = process.argv.includes('--dry-run')
const WS_FILE = '.chronicle/workspace.json'

function log(...args) { console.log('[reset-cms]', ...args) }

async function main() {
  if (DRY_RUN) log('DRY RUN — 不写入文件')

  const sch = readSchema('packages/manager/schemas/system-settings.schema.json')
  const defaults = buildSchemaDefaults(sch)

  // backendBackgroundMeta 是组件持有的对象 meta（x-widget hidden），不应重置为空——
  // 它由 BackgroundEditor 组件 persistBg 维护；重置为默认 meta 结构保持一致性。
  const metaDefaults = {
    mode: 'cover',
    posX: 50, posY: 50, size: 100, blur: 0,
    overlayLightColor: '#000000', overlayLightOpacity: 0,
    overlayDarkColor: '#000000', overlayDarkOpacity: 0,
    videoAutoplay: true, videoLoop: true, videoPlaybackRate: 1,
  }
  if (defaults.backendBackgroundMeta === '') {
    defaults.backendBackgroundMeta = metaDefaults
  } else if (defaults.backendBackgroundMeta && typeof defaults.backendBackgroundMeta === 'object') {
    defaults.backendBackgroundMeta = { ...metaDefaults, ...defaults.backendBackgroundMeta }
  }

  const abs = path.join(REPO_ROOT, WS_FILE)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  const content = JSON.stringify(defaults, null, 2) + '\n'
  if (DRY_RUN) {
    log('将写入:', WS_FILE, '→', JSON.stringify(defaults, null, 2).slice(0, 200) + '…')
  } else {
    fs.writeFileSync(abs, content, 'utf-8')
    log(WS_FILE + ' 已重置为 system-settings 默认值')
  }
  log('完成' + (DRY_RUN ? '（dry-run）' : ''))
}

main().catch((e) => { console.error('[reset-cms] 失败:', e); process.exit(1) })
