/**
 * Chronicle Gen — Image Processor
 *
 * Sharp-based image processing pipeline for CI/CD builds.
 * Handles:
 * - Generic image → WebP compression
 * - Background image processing (blur-aware compression)
 * - Avatar processing
 *
 * Design:
 *   data/branding/ uses fixed filenames (background.*, avatar.*).
 *   No more chr_f_bg-* / chr_b_bg-* prefix naming.
 *   Compression happens at build time; data/ stores source-quality images.
 */

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import sharp from 'sharp'

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface BackgroundMeta {
  url?: string
  sourcePath: string
  sourceName: string
  mode?: string
  posX?: number
  posY?: number
  size?: number
  blur?: number
  overlayLightColor?: string
  overlayLightOpacity?: number
  overlayDarkColor?: string
  overlayDarkOpacity?: number
  overlayColor?: string
  overlayOpacity?: number
  compressionFactor?: number
  compression?: number
  bgCompression?: number
  originalHeight?: number
}

export interface CompressResult {
  success: boolean
  skipped?: boolean
  url?: string
  path?: string
  sourcePath?: string
  sourceName?: string
  message?: string
}

export interface BackgroundResult extends CompressResult {
  compression?: number
  meta?: BackgroundMeta
  background?: {
    url: string
    path: string
    sourcePath: string
    sourceName: string
  }
}

// ═══════════════════════════════════════════════════════════════
// Batch compression: scan assets/ and posts/ → gen-cache
// ═══════════════════════════════════════════════════════════════

const IMAGE_EXTS = /\.(jpg|jpeg|png|gif|svg)$/i

export interface BatchCompressResult {
  total: number; compressed: number; skipped: number; errors: string[]
}

export async function batchCompress(options: {
  sourceDir: string; cacheDir: string
}): Promise<BatchCompressResult> {
  const { sourceDir, cacheDir } = options
  const result: BatchCompressResult = { total: 0, compressed: 0, skipped: 0, errors: [] }
  if (!fs.existsSync(sourceDir)) return result

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const name = entry.name
    if (name.startsWith('.') || name === 'index.md' || name === 'index.json') continue

    const src = path.join(sourceDir, name)
    if (entry.isDirectory()) {
      const sub = await batchCompress({ sourceDir: src, cacheDir: path.join(cacheDir, name) })
      result.total += sub.total; result.compressed += sub.compressed
      result.skipped += sub.skipped; result.errors.push(...sub.errors)
    } else if (IMAGE_EXTS.test(name)) {
      result.total++
      const base = path.parse(name).name
      const out = cacheDir
      if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true })
      try {
        await sharp(src).webp({ quality: 80, effort: 4 }).toFile(path.join(out, `${base}.webp`))
        result.compressed++
      } catch (e: any) { result.errors.push(`${name}: ${e.message}`) }
      try {
        await sharp(src).avif({ quality: 55, effort: 4 }).toFile(path.join(out, `${base}.avif`))
      } catch (e: any) {}
    }
  }
  return result
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function normalizeBackgroundPath(rawValue: unknown): string {
  let candidate = ''
  if (typeof rawValue === 'string') {
    candidate = rawValue
  } else if (rawValue && typeof rawValue === 'object') {
    const obj = rawValue as Record<string, unknown>
    candidate = String(obj.sourcePath || obj.path || obj.url || '')
  }
  if (!candidate) return ''

  // Strip legacy URL prefixes
  return candidate
    .replace(/^https?:\/\/[^/]+\//, '/')
    .replace(/^\/+/, '')
    .replace(/^server\/data\/(upload|branding|background|manager-background)\//, '')
    .replace(/^\.\.?\//g, '')
    .trim()
}

function computeBackgroundCompression(
  meta: BackgroundMeta,
  sourcePath: string,
  uploadDir: string,
): number {
  // Explicit compression factor
  const explicit = Number(meta.compressionFactor || meta.compression || meta.bgCompression || 0)
  if (Number.isFinite(explicit) && explicit > 1) return Math.min(30, explicit)

  // Blur-aware compression
  const blurs = [
    meta.blur,
    meta.overlayLightOpacity,
    meta.overlayDarkOpacity,
  ].map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)

  if (!blurs.length) return 1

  try {
    const absPath = path.resolve(uploadDir, sourcePath)
    if (!fs.existsSync(absPath)) return 1
    const metadata = sharp(absPath).metadataSync?.() ?? sharp(absPath)
    // We need to get metadata; but sharp metadata is async
    // Fallback to a reasonable default
    return Math.min(30, 12)
  } catch {
    return 1
  }
}

// ═══════════════════════════════════════════════════════════════
// Background compression
// ═══════════════════════════════════════════════════════════════

/**
 * Compress a background image and write to branding/background.webp.
 *
 * Key changes from legacy:
 * - Output is always branding/background.webp (fixed filename, no hash prefix)
 * - No more chr_f_bg-* / chr_b_bg-* naming
 * - URL is a simple relative path (no /server/data/ prefix)
 */
export async function compressBackground(options: {
  background: unknown
  meta?: BackgroundMeta | null
  uploadDir: string
  brandingDir: string
}): Promise<BackgroundResult> {
  const { background, meta, uploadDir, brandingDir } = options

  if (!meta || typeof meta !== 'object') {
    return { success: true, skipped: true, message: 'Missing meta', meta: null as any, background: background as any }
  }

  const sourcePath = normalizeBackgroundPath(background)
  if (!sourcePath) {
    return { success: true, skipped: true, message: 'Missing background source', meta, background: background as any }
  }

  const absSource = path.resolve(uploadDir, sourcePath)
  if (!fs.existsSync(absSource)) {
    return { success: true, skipped: true, message: `Source not found: ${sourcePath}`, meta, background: background as any }
  }

  const compression = await computeBackgroundCompressionAsync(meta, absSource)
  const quality = Math.max(35, Math.min(92, Math.round(92 - (compression - 1) * 5)))

  // Output: fixed filename — branding/background.webp
  const outputPath = path.join(brandingDir, 'background.webp')

  // Ensure output directory exists
  if (!fs.existsSync(brandingDir)) {
    fs.mkdirSync(brandingDir, { recursive: true })
  }

  try {
    await sharp(absSource, { failOnError: false })
      .webp({ quality, effort: 4 })
      .toFile(outputPath)

    const nextMeta = { ...meta, compressionFactor: compression, compression, bgCompression: compression }

    return {
      success: true,
      compression,
      meta: nextMeta,
      background: {
        url: '/branding/background.webp',
        path: 'background.webp',
        sourcePath,
        sourceName: path.basename(sourcePath),
      },
    }
  } catch (e: any) {
    return { success: true, skipped: true, message: `sharp failed: ${e.message}`, meta, background: background as any }
  }
}

async function computeBackgroundCompressionAsync(meta: BackgroundMeta, absSource: string): Promise<number> {
  const explicit = Number(meta.compressionFactor || meta.compression || meta.bgCompression || 0)
  if (Number.isFinite(explicit) && explicit > 1) return Math.min(30, explicit)

  try {
    const metadata = await sharp(absSource).metadata()
    const sourceHeight = metadata.height ?? 0
    const blurs = [meta.blur].map(v => Number(v)).filter(v => Number.isFinite(v) && v > 0)
    if (!blurs.length || sourceHeight <= 0) return 1

    const factor = (sourceHeight / 1000) * 0.6 * Math.min(...blurs)
    if (!Number.isFinite(factor) || factor <= 1) return 1
    return Math.min(30, factor)
  } catch {
    return 1
  }
}

// ═══════════════════════════════════════════════════════════════
// Generic image compression
// ═══════════════════════════════════════════════════════════════

export interface CompressImageOptions {
  sourcePath: string
  uploadDir: string
  outputDir: string
  outputName: string
  quality?: number
  resizeWidth?: number
  resizeHeight?: number
}

/**
 * Compress any image to WebP.
 *
 * Caller decides the output directory and filename.
 * Used for asset optimization in CI/CD builds.
 */
export async function compressImage(options: CompressImageOptions): Promise<CompressResult> {
  const {
    sourcePath,
    uploadDir,
    outputDir,
    outputName,
    quality = 80,
    resizeWidth,
    resizeHeight,
  } = options

  const absSource = path.resolve(uploadDir, sourcePath)
  if (!fs.existsSync(absSource)) {
    return { success: false, message: `Source not found: ${sourcePath}` }
  }

  const absTarget = path.resolve(outputDir, outputName)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  try {
    let transformer = sharp(absSource, { failOnError: false })
      .webp({ quality: Math.round(quality), effort: 4 })

    if (resizeWidth || resizeHeight) {
      transformer = transformer.resize({
        width: resizeWidth || undefined,
        height: resizeHeight || undefined,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    await transformer.toFile(absTarget)

    return {
      success: true,
      path: outputName,
      sourcePath,
      sourceName: path.basename(sourcePath),
    }
  } catch (e: any) {
    return { success: false, message: `sharp failed: ${e.message}` }
  }
}

/**
 * Compress an avatar image.
 * Output: branding/avatar.webp (fixed filename).
 */
export async function compressAvatar(options: {
  sourcePath: string
  uploadDir: string
  brandingDir: string
  size?: number
}): Promise<CompressResult> {
  const { sourcePath, uploadDir, brandingDir, size = 256 } = options

  const absSource = path.resolve(uploadDir, sourcePath)
  if (!fs.existsSync(absSource)) {
    return { success: false, message: `Avatar source not found: ${sourcePath}` }
  }

  if (!fs.existsSync(brandingDir)) {
    fs.mkdirSync(brandingDir, { recursive: true })
  }

  const outputPath = path.join(brandingDir, 'avatar.webp')

  try {
    await sharp(absSource, { failOnError: false })
      .resize(size, size, { fit: 'cover' })
      .webp({ quality: 85, effort: 4 })
      .toFile(outputPath)

    return {
      success: true,
      path: 'avatar.webp',
      sourcePath,
      sourceName: path.basename(sourcePath),
    }
  } catch (e: any) {
    return { success: false, message: `Avatar compression failed: ${e.message}` }
  }
}
