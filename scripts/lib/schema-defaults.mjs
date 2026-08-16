/**
 * Chronicle Aurora — schema 默认值生成工具（全局重置共用）
 *
 * 输入 JSON Schema（draft-2020-12 + x-* 扩展），递归生成默认数据对象：
 *   - 有 default → 深拷贝 default
 *   - object → 递归子属性（空对象兜底）
 *   - array → []
 *   - boolean → false，number/integer → 0，string → ''
 *
 * 与 manager 的 useSchemaForm.buildDefaults 保持同一规则（两处各自维护）。
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(__dirname, '..', '..')

/** 递归生成 schema 默认值对象 */
export function buildSchemaDefaults(schema) {
  if (schema?.type === 'array') return []
  const defaults = {}
  const props = schema?.properties || {}
  for (const [key, prop] of Object.entries(props)) {
    const p = prop || {}
    if (p.default !== undefined) {
      defaults[key] = JSON.parse(JSON.stringify(p.default))
    } else if (p.type === 'object') {
      defaults[key] = buildSchemaDefaults(p)
    } else if (p.type === 'array') {
      defaults[key] = []
    } else if (p.type === 'boolean') {
      defaults[key] = false
    } else if (p.type === 'number' || p.type === 'integer') {
      defaults[key] = 0
    } else {
      defaults[key] = ''
    }
  }
  return defaults
}

/** 读取 schema JSON（路径相对 REPO_ROOT） */
export function readSchema(relPath) {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, relPath), 'utf-8'))
}

/** 背景渲染 meta 默认值（与 BackgroundEditorModal.defaultMeta 对齐，去掉 undefined 兼容键） */
export const BACKGROUND_META_DEFAULTS = {
  mode: 'cover',
  posX: 50,
  posY: 50,
  size: 100,
  blur: 20,
  overlayLightColor: '#fefbfb',
  overlayLightOpacity: 75,
  overlayDarkColor: '#000000',
  overlayDarkOpacity: 80,
  videoAutoplay: true,
  videoLoop: true,
  videoPlaybackRate: 1,
  baseColorLight: '',
  baseColorDark: '',
}
