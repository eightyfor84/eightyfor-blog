#!/usr/bin/env node

/**
 * Chronicle Gen CLI
 *
 * Content generation entry point. Can be called standalone or embedded
 * in the Electron desktop app.
 *
 * Usage:
 *   npx chronicle-gen build              Full SSG build
 *   npx chronicle-gen cdn purge|warm     CDN cache management
 */

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const command = process.argv[2] || 'help'

switch (command) {
  case 'build':
  case 'b': {
    import('../src/builder/astro.mjs').then(({ buildCommand }) => {
      buildCommand(process.argv.slice(3));
    });
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
    console.log(`Chronicle Gen — Content Generation

Usage: npx chronicle-gen <command> [options]

Commands:
  build, b     Run Astro SSG build
  cdn, c       CDN cache management (purge, warm)

Build Options:
  --dataDir, -d   <path>   Path to data directory
  --codeDir, -c   <path>   Path to Astro project directory
  --targetDir, -t <path>   Where to place final build output
  --granularity, -g <full|posts|index>  Build granularity (default: full)
`)
    break
  }
}
