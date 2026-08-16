#!/usr/bin/env node
/**
 * Chronicle Aurora — 清空 data/（全局重置 ③）
 *
 * 清空内容数据，回到全新博客状态：
 *   - 删除: posts/*（含文章与 index.json）、comments/、comments-pending/、assets/、
 *     avatar/、background/ 图片与 meta、branding/、__about__/
 *   - 保留: 目录结构本身（空目录 + 各 yml 数据文件 —— 模板设置重置由 reset-site 负责）
 *
 * 用法: node scripts/reset-data.mjs [--dry-run]
 */

import fs from 'node:fs'
import path from 'node:path'
import { REPO_ROOT } from './lib/schema-defaults.mjs'

const DRY_RUN = process.argv.includes('--dry-run')

// 清空目标：目录被整体清空（内容删除，目录保留）
const DIRS = [
  'data/posts',
  'data/comments',
  'data/comments-pending',
  'data/assets',
  'data/avatar',
  'data/branding',
  'data/__about__',
].map((d) => path.join(REPO_ROOT, d))

// background 目录：只清图片/视频媒体（background.yml 是 yml 数据文件，由 reset-site 重置）
const BG_DIR = path.join(REPO_ROOT, 'data', 'background')
const MEDIA_RE = /\.(jpg|jpeg|png|gif|webp|avif|svg|mp4|webm|mov|heic)$/i

// 重建的骨架文件（空 posts 索引 + 空 comments 目录占位说明）
function ensureSkeleton() {
  const postsDir = path.join(REPO_ROOT, 'data', 'posts')
  fs.mkdirSync(postsDir, { recursive: true })
  const idxPath = path.join(postsDir, 'index.json')
  if (!DRY_RUN) fs.writeFileSync(idxPath, '{}\n', 'utf-8')
}

function log(...args) { console.log('[reset-data]', ...args) }

async function main() {
  if (DRY_RUN) log('DRY RUN — 不写入文件')

  const remove = (abs, rel) => {
    if (DRY_RUN) log('将删除:', rel)
    else { fs.rmSync(abs, { recursive: true, force: true }); log('已删除:', rel) }
  }

  for (const dir of DIRS) {
    if (!fs.existsSync(dir)) { log('跳过（不存在）:', path.relative(REPO_ROOT, dir)); continue }
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = path.relative(REPO_ROOT, abs)
      remove(abs, rel)
    }
  }

  // background：只清媒体，保留 background.yml
  if (fs.existsSync(BG_DIR)) {
    const entries = fs.readdirSync(BG_DIR, { withFileTypes: true })
    for (const e of entries) {
      if (e.name === 'background.yml') continue
      const abs = path.join(BG_DIR, e.name)
      if (e.isDirectory() || MEDIA_RE.test(e.name)) remove(abs, path.relative(REPO_ROOT, abs))
    }
  } else if (!DRY_RUN) {
    fs.mkdirSync(BG_DIR, { recursive: true })
  }

  if (!DRY_RUN) {
    ensureSkeleton()
    log('已重建 data/posts/index.json（空索引）')
  }
  log('完成' + (DRY_RUN ? '（dry-run，未删除）' : ' — data/ 已清空，保留目录与 yml 数据文件'))
}

main().catch((e) => { console.error('[reset-data] 失败:', e); process.exit(1) })
