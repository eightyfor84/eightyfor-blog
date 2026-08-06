/**
 * Chronicle Gen — Astro Build Orchestrator
 *
 * Wraps the Astro SSG build process. Can be called:
 * - From CLI:   chronicle-gen build
 * - From host:   import { runBuild } from '@chronicle/gen'
 * - As worker:   node --worker build-worker.mjs
 *
 * In the future this will support incremental builds and queue management.
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { isAbsolute, join, parse } from 'node:path'

export interface BuildOptions {
  /** Path to the Astro project directory */
  codeDir: string
  /** Where to place the built files (TODO: implement copy-to-target logic) */
  targetDir?: string
  /** Build granularity: full | posts | index (TODO: implement incremental builds) */
  granularity?: 'full' | 'posts' | 'index'
}

export interface BuildResult {
  success: boolean
  distDir?: string
  error?: string
  duration?: number
}

/**
 * Run an Astro SSG build in the specified directory.
 *
 * This is the primary build entry point — the host calls this
 * when a user triggers a build from the CMS, and the CLI calls
 * it directly.
 *
 * NOTE: This function is synchronous because it wraps `execSync`.
 * Callers that need a Promise can use `Promise.resolve(runBuild(opts))`.
 */
export function runBuild(opts: BuildOptions): BuildResult {
  const { codeDir, targetDir } = opts
  const startTime = Date.now()

  if (!codeDir) {
    return { success: false, error: 'Frontend code dir not provided' }
  }

  if (!existsSync(codeDir)) {
    return { success: false, error: `Frontend code dir not found: ${codeDir}` }
  }

  if (targetDir) {
    if (!isAbsolute(targetDir) || targetDir === parse(targetDir).root) {
      return { success: false, error: `Invalid build target dir: ${targetDir}` }
    }
  }

  try {
    console.log('[chronicle-gen] Building in directory:', codeDir)

    execSync('npm run build', {
      cwd: codeDir,
      stdio: 'inherit',
      env: process.env,
    })

    const distDir = join(codeDir, 'dist')
    if (!existsSync(distDir)) {
      return { success: false, error: `Build output not found: ${distDir}` }
    }

    const duration = Date.now() - startTime
    console.log(`[chronicle-gen] Build completed successfully in ${duration}ms`)

    return { success: true, distDir, duration }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[chronicle-gen] Build failed:', message)
    return { success: false, error: message }
  }
}
