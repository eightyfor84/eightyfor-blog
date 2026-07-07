#!/usr/bin/env node

/**
 * Chronicle Gen CLI
 *
 * Content generation entry point. Can be called standalone or from host.
 *
 * Usage:
 *   npx chronicle-gen build              Full SSG build
 *   npx chronicle-gen build --posts      Posts-only build
 *   npx chronicle-gen sync               Sync content from external sources
 *   npx chronicle-gen watch              Watch for file changes
 *
 * In the future, this will run independently as a CLI tool or be embedded
 * in the Electron desktop app.
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const command = process.argv[2] || 'help'

switch (command) {
  case 'convert': {
    import('../src/commands/convert.mjs').then(({ convertCommand }) => {
      convertCommand(process.argv.slice(3));
    });
    break
  }
  case 'build':
  case 'b': {
    import('../src/builder/astro.mjs').then(({ buildCommand }) => {
      buildCommand(process.argv.slice(3));
    });
    break
  }
  case 'sync':
  case 's': {
    console.log('[chronicle-gen] Sync not yet implemented (Notion, etc.)')
    break
  }
  case 'watch':
  case 'w': {
    console.log('[chronicle-gen] Watch not yet implemented')
    break
  }
  case 'cdn':
  case 'c': {
    import('../src/commands/cdn.mjs').then(({ cdnCommand }) => {
      cdnCommand(process.argv.slice(3));
    });
    break;
  }
  case 'help':
  case '--help':
  case '-h':
  default: {
    console.log(`Chronicle Gen — Content Generation Server

Usage: npx chronicle-gen <command> [options]

Commands:
  build, b     Run Astro SSG build
    --site, -s   Convert site/ → data/ before building (lite mode)
  convert      Convert site/ directory → data/ format
  sync, s      Sync content from external sources (Notion, etc.)
  watch, w     Watch for content changes and rebuild
  cdn, c       CDN cache management (purge, warm)

Build Options:
  --dataDir, -d   <path>   Path to data directory
  --codeDir, -c   <path>   Path to Astro project directory
  --targetDir, -t <path>   Where to place final build output
  --granularity, -g <full|posts|index>  Build granularity (default: full)
  --siteDir, -s   <path>   Path to site/ directory (for convert step)

Convert Options:
  --siteDir, -s   <path>   Path to site/ directory (default: ./site)
  --dataDir, -d   <path>   Path to data/ directory (default: ./data)
`)
    break
  }
}
