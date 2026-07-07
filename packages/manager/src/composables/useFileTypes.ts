/**
 * useFileTypes — Pure utility functions for file type detection.
 *
 * Single source of truth for extension→type mappings used by
 * FilePicker, FileManager, and any future file-browsing UI.
 *
 * Zero Vue dependency — these are plain functions, not reactive composables.
 * Named `use*.ts` to follow the project's composables/ directory convention.
 */

import { Icons } from '../utils/icons'

// ── Extension regex constants (source of truth) ──────────────────────

export const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i
export const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi)$/i
export const AUDIO_EXT = /\.(mp3|wav|ogg|flac|m4a|aac)$/i
export const DOC_EXT   = /\.(pdf|docx?|pptx?|xlsx?)$/i
export const CODE_EXT  = /\.(txt|md|js|ts|json|c|cpp|h|java|py|sh|bat|ini|conf|vue|log|csv|xml|yaml|yml|rs|go|php|css|html)$/i

// ── Result type ──────────────────────────────────────────────────────

export interface FileTypeFlags {
    isImage: boolean
    isVideo: boolean
    isAudio: boolean
    isDocument: boolean
    isCode: boolean
}

export type FileTypeName   = 'image' | 'video' | 'audio' | 'document' | 'text' | 'file'
export type CategoryId     = 'pic' | 'video' | 'sound' | 'doc' | 'txt' | 'other'
export type TypeTabId      = 'image' | 'video' | 'audio' | 'document' | 'text' | 'other'

// ── Core detection ───────────────────────────────────────────────────

/**
 * Detect file type from a File object or a plain filename string.
 * Prefers MIME-type matching when a File object is provided.
 */
export function detectFileType(fileOrName: any): FileTypeFlags {
    let name = ''
    let mime = ''

    if (typeof fileOrName === 'string') {
        name = fileOrName.toLowerCase()
    } else if (fileOrName && typeof fileOrName === 'object') {
        name = String(fileOrName?.name || fileOrName?.displayname || '').toLowerCase()
        mime = String(fileOrName?.type || fileOrName?.mimeType || '').toLowerCase()
    }

    const isImage    = /^image\//.test(mime)    || IMAGE_EXT.test(name)
    const isVideo    = /^video\//.test(mime)    || VIDEO_EXT.test(name)
    const isAudio    = /^audio\//.test(mime)    || AUDIO_EXT.test(name)
    const isDocument = DOC_EXT.test(name)        // MIME for docs is too variable
    const isCode     = CODE_EXT.test(name) && !isDocument

    return { isImage, isVideo, isAudio, isDocument, isCode }
}

/** Convenience: check if a filename represents an image. */
export function isImage(name: string): boolean {
    return IMAGE_EXT.test(name)
}

// ── String-type classifiers ──────────────────────────────────────────

/**
 * Return a canonical type string (used for the `type` field on file entries).
 */
export function getFileTypeFromName(filename: string): FileTypeName {
    const name = (filename || '').toLowerCase()
    if (IMAGE_EXT.test(name)) return 'image'
    if (VIDEO_EXT.test(name)) return 'video'
    if (AUDIO_EXT.test(name)) return 'audio'
    if (DOC_EXT.test(name))   return 'document'
    if (CODE_EXT.test(name))  return 'text'
    return 'file'
}

/**
 * Return a server-side category id (used for API `?categories=` param and
 * FileManager sidebar filtering).
 */
export function getCategoryFromFile(file: any): CategoryId {
    const { isImage, isVideo, isAudio, isDocument, isCode } = detectFileType(file)
    if (isImage)    return 'pic'
    if (isVideo)    return 'video'
    if (isAudio)    return 'sound'
    if (isDocument) return 'doc'
    if (isCode)     return 'txt'
    return 'other'
}

/**
 * Return a type-tab id (used for FilePicker's cloud-leftbar tabs).
 */
export function detectTypeTab(file: any): TypeTabId {
    const { isImage, isVideo, isAudio, isDocument, isCode } = detectFileType(file)
    if (isImage)    return 'image'
    if (isVideo)    return 'video'
    if (isAudio)    return 'audio'
    if (isDocument) return 'document'
    if (isCode)     return 'text'
    return 'other'
}

// ── Icon ─────────────────────────────────────────────────────────────

/** Return the SVG icon HTML for a file based on its name. */
export function getIconForFile(name: string): string {
    const { isImage, isVideo, isAudio, isDocument, isCode } = detectFileType(name)
    if (isImage)    return Icons.image
    if (isAudio)    return Icons.audio
    if (isVideo)    return Icons.video
    if (isDocument) return Icons.document
    if (isCode)     return Icons.codeText
    return Icons.generic
}

// ── Translated label ─────────────────────────────────────────────────

/**
 * Return a human-readable, i18n-translated file type label.
 * Accepts the vue-i18n `t` function so the caller controls locale.
 */
export function getFileTypeLabel(
    name: string,
    t: (key: string) => string,
): string {
    const { isImage, isVideo, isAudio, isDocument, isCode } = detectFileType(name)
    if (isImage)    return t('file.type.image')
    if (isAudio)    return t('file.type.audio')
    if (isVideo)    return t('file.type.video')
    if (isDocument) return t('file.type.document')
    if (isCode)     return t('file.type.code') || t('file.type.file')
    return t('file.type.file')
}

// ── Thumbnail URL ────────────────────────────────────────────────────

export interface ThumbFile {
    thumb?: string
    url?: string
    path?: string
}

/**
 * Derive a thumbnail URL for a file entry.
 * 1. Prefer server-provided `thumb` field
 * 2. Derive from `url` by replacing `/upload/` → `/upload/.thumbs/`
 * 3. Fallback to canonical `.thumbs/` path
 */
export function getThumbUrl(file: ThumbFile): string {
    if (file.thumb && typeof file.thumb === 'string') {
        return file.thumb
    }
    if (file.url && typeof file.url === 'string') {
        return file.url.replace('/server/data/upload/', '/server/data/upload/.thumbs/')
    }
    return `/server/data/upload/.thumbs/${file.path || ''}`
}

// ── Category / type mapping utilities ────────────────────────────────

/** Map a FileTypeName to the server-side category id. */
export function mapTypeToCategory(fileType: string): string | null {
    const map: Record<string, string> = {
        image:    'pic',
        video:    'video',
        audio:    'sound',
        document: 'doc',
        text:     'txt',
        file:     'other',
    }
    return map[fileType] || null
}

/** Inverse of mapTypeToCategory (subset used in FilePicker). */
export function standardizeFileType(raw: string): string {
    const map: Record<string, string> = {
        document: 'doc',
        audio:    'sound',
        video:    'video',
        image:    'pic',
        text:     'txt',
    }
    return map[raw] || raw
}

/**
 * Convert a list of restrictedTypes (image/video/audio/document/text/file)
 * into server-side category codes for the `?categories=` API param.
 */
export function getCategoriesFromRestrictedTypes(restrictedTypes: string[]): string[] {
    if (!restrictedTypes || restrictedTypes.length === 0) return []

    const categories = new Set<string>()
    for (const type of restrictedTypes) {
        const cat = mapTypeToCategory(type.toLowerCase())
        if (cat) categories.add(cat)
    }
    return Array.from(categories)
}

/**
 * Check whether a filename (and optional MIME) is allowed under a
 * restricted-types whitelist.  An empty / null whitelist allows everything.
 */
export function isFileTypeAllowed(
    filename: string,
    restrictedTypes: string[] | null | undefined,
    mimeType?: string,
): boolean {
    if (!restrictedTypes || restrictedTypes.length === 0) return true

    const fileType = getFileTypeFromName(filename)
    const ext = filename.split('.').pop()?.toLowerCase() || ''

    return restrictedTypes.some((allowed) => {
        const a = allowed.toLowerCase()

        if (a === fileType) return true                          // "image"
        if (a.startsWith('.')) return ext === a.slice(1)         // ".jpg"
        if (a.includes('/')) {
            return mimeType ? mimeType.toLowerCase().startsWith(a) : false // "image/*"
        }
        return ext === a                                         // "jpg"
    })
}

// ── Type prefix for markdown links ──────────────────────────────────

const TYPE_PREFIX_MAP: Record<string, string> = {
    image:    'image',
    video:    'video',
    audio:    'audio',
    document: 'document',
    text:     'text',
    file:     'file',
}

/**
 * Return a type-prefix string for insertion into markdown links.
 * E.g. "document:report.pdf", "audio:sound.mp3"
 * The prefix enables file-card detection without requiring a blob URL.
 */
export function getTypePrefix(filename: string): string {
    const type = getFileTypeFromName(filename)
    const prefix = TYPE_PREFIX_MAP[type] || 'file'
    return `${prefix}:${filename}`
}
