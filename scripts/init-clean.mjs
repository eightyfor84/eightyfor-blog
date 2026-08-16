#!/usr/bin/env node
/**
 * Chronicle Aurora — 干净初始化（全局重置全做）
 *
 * 顺序执行三个全局重置：
 *   1. reset-site  — 模板设置 → schema 默认（site/profile/friends/collections/background.yml）
 *   2. reset-cms   — CMS 配置 → system-settings 默认（.chronicle/workspace.json）
 *   3. reset-data  — 清空 data/ 内容（文章/评论/媒体），重建空索引
 *
 * 结果：全新博客状态，所有设置回到「我们目前的配置」（schema default），内容清空。
 *
 * 用法: node scripts/init-clean.mjs [--dry-run]
 */

import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { REPO_ROOT } from './lib/schema-defaults.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

const STEPS = [
  { name: '重置模板设置', script: 'scripts/reset-site.mjs' },
  { name: '重置 CMS 配置', script: 'scripts/reset-cms.mjs' },
  { name: '清空 data/ 内容', script: 'scripts/reset-data.mjs' },
]

function log(...args) { console.log('[init-clean]', ...args) }

async function main() {
  log('干净初始化开始' + (DRY_RUN ? '（dry-run）' : ''))

  for (const step of STEPS) {
    log('→ ' + step.name + ' (' + step.script + ')')
    const args = [path.join(REPO_ROOT, step.script)]
    if (DRY_RUN) args.push('--dry-run')
    const res = spawnSync(process.execPath, args, { stdio: 'inherit' })
    if (res.status !== 0) {
      console.error('[init-clean] 步骤失败:', step.name, '(exit', res.status + ')')
      process.exit(res.status || 1)
    }
  }

  log('干净初始化完成' + (DRY_RUN ? '（dry-run，未写入）' : ' — 可 git 检查后提交'))
}

main().catch((e) => { console.error('[init-clean] 失败:', e); process.exit(1) })
