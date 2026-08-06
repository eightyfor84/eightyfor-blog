/**
 * Chronicle — Shared Marp Slide Parser
 *
 * Pure logic (zero runtime dependencies) shared by manager (browser CMS preview)
 * and template-astro (Node.js SSG build). Each consumer injects its own
 * renderSlide callback to produce slide HTML.
 *
 * Slide separator rule:
 *   Only `---` on its own line, no leading whitespace, surrounded by blank lines
 *   (or document boundaries) is treated as a slide separator.
 *   `***` and `___` are always rendered as <hr>.
 */

import type { SlideshowConfig } from '../types/post.js'

export interface ParsedSlide {
  index: number
  markdown: string
  html: string
  directives: Record<string, string>
  notes: string
  hasNotes: boolean
}

export interface SlideMeta {
  type: 'slides'
  config: SlideshowConfig
  globalDirectives: Record<string, string>
  slideCount: number
}

/** Directive marker: <!-- key: value --> (global) or <!-- _key: value --> (local) */
const DIRECTIVE_RE = /^<!--\s*(_)?\s*([a-zA-Z][\w-]*)\s*:\s*(.*?)\s*-->$/

/** Speaker notes marker: everything after <!-- speaker notes --> until next slide or EOF */
const SPEAKER_NOTES_RE = /^<!--\s*speaker notes\s*-->$/i

/** Slide separator: a line that is exactly "---", no leading whitespace */
const SLIDE_SEP_RE = /^---$/

/**
 * Check if the line at `i` is a slide separator.
 * Requires blank line or boundary above AND below.
 */
function isSlideSep(lines: string[], i: number): boolean {
  if (!SLIDE_SEP_RE.test(lines[i])) return false
  // Above must be blank or boundary
  const aboveBlank = i === 0 || lines[i - 1].trim() === ''
  // Below must be blank or boundary
  const belowBlank = i === lines.length - 1 || lines[i + 1].trim() === ''
  // Not part of frontmatter (first --- ... --- pair)
  return aboveBlank && belowBlank
}

/**
 * Extract YAML frontmatter from the beginning of markdown.
 * Returns { attributes, body } where body is everything after the closing ---.
 */
function extractFrontmatter(
  markdown: string
): { attributes: Record<string, any>; body: string } {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!fmMatch) return { attributes: {}, body: markdown }

  const rawAttrs = fmMatch[1]
  const body = markdown.slice(fmMatch[0].length)
  const attributes: Record<string, any> = {}

  // Simple YAML subset parser (same as existing frontmatter parsers)
  rawAttrs.split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) return
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (!key) return
    if (key === 'tags') {
      try {
        attributes[key] = JSON.parse(value)
      } catch {
        attributes[key] = value
          .split(/,\s*/)
          .filter(Boolean)
      }
    } else if (key === 'slideshow') {
      try {
        attributes[key] = JSON.parse(value)
      } catch {
        // If not JSON, try as YAML-like key:value pairs (simple)
        attributes[key] = parseSlideshowYaml(value)
      }
    } else if (value === 'true') {
      attributes[key] = true
    } else if (value === 'false') {
      attributes[key] = false
    } else {
      attributes[key] = value
    }
  })

  // Normalize Marp-native frontmatter to Chronicle internal format
  normalizeMarpFrontmatter(attributes)

  return { attributes, body }
}

/**
 * Map Marp-native flat frontmatter fields to Chronicle's nested format.
 *
 *   marp: true          →  type: slides
 *   theme: gaia         →  slideshow.theme: gaia
 *   size: 16:9          →  slideshow.ratio: 16:9
 *   footer: "..."       →  slideshow.footer: "..."
 *   paginate: true      →  kept as attribute (→ global directive)
 *   header: "..."       →  kept as attribute (→ global directive)
 *   class: lead         →  kept as attribute (→ global directive)
 *   backgroundColor:    →  kept as attribute
 *   backgroundImage:    →  kept as attribute
 *   color:              →  kept as attribute
 */
function normalizeMarpFrontmatter(attrs: Record<string, any>): void {
  // Detect Marp document: explicit marp:true, or Marp-specific fields with no Chronicle type
  const isMarp = attrs.marp === true
  const hasSlideshow = attrs.slideshow && typeof attrs.slideshow === 'object'
  const hasType = attrs.type === 'slides'

  if (!isMarp && (hasType || (!attrs.marp && !attrs.theme && !attrs.size))) return

  // Mark as slides
  if (!hasType) attrs.type = 'slides'

  // Build slideshow config from flat fields if not already nested
  const flatToSlideshow: Record<string, string> = {}
  const redirectKeys = new Set(['theme', 'size', 'footer'])

  for (const key of redirectKeys) {
    if (attrs[key] !== undefined && !hasSlideshow) {
      flatToSlideshow[key] = attrs[key]
    }
  }

  if (Object.keys(flatToSlideshow).length > 0) {
    const existing = (hasSlideshow && typeof attrs.slideshow === 'object') ? attrs.slideshow : {}
    attrs.slideshow = {
      theme: (existing as any).theme || flatToSlideshow['theme'],
      ratio: (existing as any).ratio || flatToSlideshow['size'],
      footer: (existing as any).footer || flatToSlideshow['footer'],
    }
  }

  // size → ratio mapping
  if (attrs.slideshow?.size && !attrs.slideshow?.ratio) {
    attrs.slideshow.ratio = attrs.slideshow.size
    delete (attrs.slideshow as any).size
  }

  // Clean up marp marker — it served its purpose
  delete attrs.marp
}

function parseSlideshowYaml(raw: string): SlideshowConfig {
  const config: SlideshowConfig = {}
  raw.split('\n').forEach((line) => {
    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) return
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim()
    if (key === 'theme') config.theme = value
    else if (key === 'ratio') config.ratio = value as any
    else if (key === 'footer') config.footer = value
  })
  return config
}

/**
 * Parse a markdown string into slides.
 *
 * @param markdown  - Raw markdown content (may include frontmatter)
 * @param renderSlide - Callback to render a single slide's markdown to HTML
 * @returns { meta, slides }
 */
export function parseSlides(
  markdown: string,
  renderSlide: (markdown: string) => string
): { meta: SlideMeta; slides: ParsedSlide[] } {
  // Phase 1: Extract frontmatter
  const { attributes, body } = extractFrontmatter(markdown)

  const type = (attributes.type as string) || 'article'
  const config: SlideshowConfig = attributes.slideshow || {}
  const globalDirectives: Record<string, string> = {}

  // Phase 2: Split body into slides by --- separator
  const lines = body.split('\n')
  const slideChunks: string[] = []
  let currentStart = 0

  for (let i = 0; i < lines.length; i++) {
    if (isSlideSep(lines, i)) {
      const chunk = lines.slice(currentStart, i).join('\n').trimEnd()
      if (chunk || slideChunks.length === 0) {
        slideChunks.push(chunk)
      }
      currentStart = i + 1
    }
  }

  // Last chunk
  const lastChunk = lines.slice(currentStart).join('\n').trimEnd()
  if (lastChunk || slideChunks.length === 0) {
    slideChunks.push(lastChunk)
  }

  // Phase 3 & 4: Parse each slide — directives, speaker notes, render HTML
  const slides: ParsedSlide[] = []
  // Accumulate global directives (non-underscore directives found on slides)
  const seenGlobals = new Set<string>()

  for (let i = 0; i < slideChunks.length; i++) {
    const raw = slideChunks[i]
    const directives: Record<string, string> = {}
    let notesStart = -1
    let cleanLines: string[] = []

    const slideLines = raw.split('\n')

    for (let j = 0; j < slideLines.length; j++) {
      const line = slideLines[j]

      // Check for speaker notes marker
      if (SPEAKER_NOTES_RE.test(line.trim())) {
        notesStart = j
        break
      }

      // Check for directive
      const dirMatch = line.trim().match(DIRECTIVE_RE)
      if (dirMatch) {
        const isLocal = dirMatch[1] === '_'
        const dirKey = dirMatch[2]
        const dirVal = dirMatch[3].trim()

        if (!isLocal) {
          directives[dirKey] = dirVal
          if (!seenGlobals.has(dirKey)) {
            globalDirectives[dirKey] = dirVal
            seenGlobals.add(dirKey)
          }
        } else {
          directives[dirKey] = dirVal
        }
        // Directives are removed from rendered markdown
        continue
      }

      cleanLines.push(slideLines[j])
    }

    // Extract speaker notes
    let notes = ''
    let hasNotes = false
    if (notesStart >= 0) {
      hasNotes = true
      notes = slideLines
        .slice(notesStart + 1)
        .join('\n')
        .trim()
    }

    const slideMarkdown = cleanLines.join('\n').trim()
    const html = renderSlide(slideMarkdown)

    slides.push({
      index: i,
      markdown: slideMarkdown,
      html,
      directives,
      notes,
      hasNotes,
    })
  }

  return {
    meta: {
      type: 'slides',
      config,
      globalDirectives,
      slideCount: slides.length,
    },
    slides,
  }
}
