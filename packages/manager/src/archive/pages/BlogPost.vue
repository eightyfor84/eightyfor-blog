<template>
  <div class="blog-post-container">
    <div v-if="loading" class="loading">Loading...</div>
    <div v-else-if="!post" class="error">Post not found.</div>
    <div v-else class="post-content-wrapper">
            <nav class="post-nav">
                <router-link to="/blogs" class="nav-back">← {{ $t('inblog.backToBlogs') }}</router-link>
            </nav>
      
      <header class="post-header">
        <h1 class="title" :class="fontClass">{{ post.title }}</h1>
        
        <div class="post-meta-info">
            <div class="meta-row stats" v-if="postStats">
                <span>{{ $t(postStats.words === 1 ? 'inblog.wordSing' : 'inblog.wordPlural', { count: postStats.words }) }}</span>
                <span class="separator">/</span>
                <span>{{ postStats.readTime }} {{ $t('inblog.min') }}</span>
            </div>
            <div class="meta-row dates">
                <span>{{ $t('inblog.created') }} {{ formatDate(post.date) }}</span>
                <template v-if="post.updatedAt && post.updatedAt !== post.date">
                    <span class="separator">·</span>
                    <span>{{ $t('inblog.updated') }} {{ formatDate(post.updatedAt) }}</span>
                </template>
            </div>
        </div>

            <div class="tags" v-if="post.tags && post.tags.length">
            <span v-for="tag in sortTags(post.tags)" :key="tag" class="tag" :class="{ featured: tag === 'featured' }" @click="router.push('/search?tags='+tag)">#{{ tag === 'featured' ? $t('tag.featured') : tag }}</span>
        </div>
      </header>

                        <!-- 页面级目录（仅阅读模式） -->
        <div v-if="toc.length" class="markdown-toc">
            <div class="toc-header" @click="toggleInlineToc" :class="{ collapsed: inlineTocCollapsed }">
                <div class="toc-title">{{ $t('inblog.toc-title') }}</div>
                <button class="toc-toggle-btn" :aria-expanded="!inlineTocCollapsed" :title="inlineTocCollapsed ? '展开' : '折叠'">
                     <span class="chev-icon" :class="{ folded: inlineTocCollapsed }" v-html="chevronIcon"></span>
                </button>
            </div>
            <div class="toc-list-shell" :class="{ open: inlineTocShellOpen }">
                <transition name="toc-expand">
                    <ul v-if="inlineTocRender" :class="['toc-list']">
                        <li v-for="(item, idx) in toc" :key="item.id" :class="[ `toc-level-${item.level}`, { active: item.id === liveActiveId } ]">
                            <a :href="`#${item.id}`" @click.prevent="onTocClick(item.id)"><span class="toc-text">{{ item.text }}</span></a>
                        </li>
                    </ul>
                </transition>
            </div>
                        </div>

              <div class="markdown-body" :class="fontClass">
                  <div v-if="showPlain" v-html="plainHtml"></div>
                  <component v-else-if="showFullParser && post.content" :is="MdParserAsync" :blocks="parsedBlocks" :modelValue="post.content" :readOnly="true" @rendered="onMdRendered" />
              </div>

            <!-- 悬浮目录导航（页面级） -->
                    <nav v-if="toc.length" class="toc-float" :class="{ collapsed: floatCollapsed, visible: showTOCandBTT }" aria-label="目录导航"
                   @mouseenter="onFloatMouseEnter" @mouseleave="onFloatMouseLeave">
                        <ul>
                            <li v-for="item in toc" :key="item.id" 
                                :class="[`toc-float-item`, `toc-level-${item.level}`, { active: item.id === liveActiveId }]">
                                    <a :href="`#${item.id}`" @click.prevent="onTocClick(item.id)" class="toc-link">
                                        <span class="toc-text">{{ item.text }}</span>
                                        <span class="toc-line" :style="{ width: lineWidth(item.level) }"></span>
                                    </a>
                            </li>
                        </ul>
                    </nav>

        <!-- Back to Top -->
                       <button class="corner-button" :class="{ visible: showTOCandBTT }" @click="scrollToTop" :title="$t('misc.backToTop')">
                                     <span v-html="Icons.arrowUp"></span>
                       </button>

                       <!-- Mobile: TOC popup trigger (left-bottom), symmetric to back-to-top -->
                       <button v-if="toc.length" class="corner-button primary" @click="toggleMobileToc" :title="$t('inblog.toc-title')">
                           <span v-html="Icons.menu"></span>
                       </button>

                       <!-- Mobile TOC panel -->
                       <div v-if="mobileTocOpen && toc.length" :class="['mobile-toc-panel', { open: mobileTocOpen }]" role="dialog" aria-label="目录">
                           <div class="mobile-toc-panel-inner">
                               <ul class="mobile-toc-list">
                                   <li v-for="item in toc" :key="item.id" :class="[`toc-level-${item.level}`, { active: item.id === liveActiveId }]">
                                       <a href="#" @click.prevent="onMobileTocItemClick(item.id)"><span class="toc-text">{{ item.text }}</span></a>
                                   </li>
                               </ul>
                           </div>
                       </div>
    </div>
    <span style="height:80px; width:100%; display:block;"/>
  </div>
</template>

<script setup lang="ts">
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
// load full parser lazily to avoid blocking navigation
const MdParserAsync = defineAsyncComponent(() => import('../components/MdParser.vue'))
import { getStats, convertToHtml, hydrateKatexIn } from '../utils/markdownParser'
import { formatDate as formatDateUtil } from '../utils/dateUtils'
import { sortTags } from '../utils/tagUtils'
import { parseMarkdown } from '../utils/markdownParser'
import { Icons } from '../utils/icons'

// i18n
const { t } = useI18n()

interface PostDetail {
  id: string
  title: string
  date: string
  updatedAt?: string
  content: string
  tags?: string[]
  font?: string
}

const route = useRoute()
const post = ref<PostDetail | null>(null)
const loading = ref(true)
// staged rendering flags
const showPlain = ref(true)
const showFullParser = ref(false)
const plainHtml = ref('')

const fontClass = computed(() => {
    if (!post.value?.font) return 'font-sans'
    return `font-${post.value.font}`
})

// Update title when post changes
import router from '../router'

// Update title when post changes
watch(post, (newPost) => {
        if (newPost && newPost.title) {
                document.title = `${newPost.title} - Chronicle`
        }
})

// 页面级 TOC
const toc = ref<Array<{ id: string, text: string, level: number }>>([])
const parsedBlocks = ref<any[]>([])
// UI state for collapsible TOC
// Default: collapsed (user requested)
const inlineTocCollapsed = ref(true)
// Shell open state controls the lightweight expand/collapse animation first
const inlineTocShellOpen = ref(false)
// Control whether the inline TOC list is actually mounted (heavy nodes)
const inlineTocRender = ref(false)
const floatCollapsed = ref(true)
let floatCollapseTimer: any = null
const activeId = ref('')
// 实时滚动位置（悬浮 TOC 使用），与锚点导航的 `activeId` 分离
const liveActiveId = ref('')
const showTOCandBTT = ref(false)
let observer: IntersectionObserver | null = null
const suppressObserver = ref(false)
// 不进行滚动时的实时锚点同步（O-3-2 要求）
const syncOnScroll = ref(false)

// Mobile TOC popup state (appearance controlled by global mobile class in app)
const mobileTocOpen = ref(false)

function toggleMobileToc() {
    mobileTocOpen.value = !mobileTocOpen.value
    if (mobileTocOpen.value) computeLiveActiveFromBaseline()
}

function onMobileTocItemClick(id: string) {
    mobileTocOpen.value = false
    setTimeout(() => onTocClick(id), 0)
}

function onTocClick(id: string) {
    try {
        // mark the clicked item as the live active one immediately so it
        // stays highlighted until the user scrolls or clicks another item
        liveActiveId.value = id
        const desired = `#${id}`
        if (typeof window === 'undefined') return
        // Use history.pushState to update the URL without causing the
        // browser's instant jump-to-anchor. Then dispatch a hashchange
        // so our centralized handler performs the smooth scroll.
        const current = window.location.hash || ''
        if (current !== desired) {
            try { history.pushState(null, '', desired) } catch (e) { window.location.hash = desired }
            setTimeout(() => { window.dispatchEvent(new Event('hashchange')) }, 0)
        } else {
            setTimeout(() => { window.dispatchEvent(new Event('hashchange')) }, 0)
        }
        // keep suppressing observer/live updates so the clicked item remains highlighted
        suppressObserver.value = true
        if (manualScrollTimer) clearTimeout(manualScrollTimer)
        manualScrollTimer = setTimeout(() => {
            suppressObserver.value = false
            manualScrollTimer = null
        }, 1200)
    } catch (e) {}
}

function handleHashChange() {
    try {
        if (typeof window === 'undefined') return
        const h = window.location.hash ? window.location.hash.replace(/^#/, '') : ''
        if (!h) return
        // ensure live highlight follows the hash navigation as well
        liveActiveId.value = h
        // suppress observer updates while we perform programmatic scroll
        suppressObserver.value = true
        scrollToHeading(h)
        if (manualScrollTimer) clearTimeout(manualScrollTimer)
        manualScrollTimer = setTimeout(() => { suppressObserver.value = false; manualScrollTimer = null }, 1200)
    } catch (e) {}
}
    let manualScrollTimer: any = null

const chevronIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`

function toggleInlineToc() {
    if (!inlineTocShellOpen.value) {
        // start shell open animation
        inlineTocShellOpen.value = true
        // rotate chevron immediately to give instant feedback
        inlineTocCollapsed.value = false
        // mount heavy list after animation completes (use transitionend fallback)
        const shell = document.querySelector('.toc-list-shell') as HTMLElement
        if (shell) {
            const onEnd = (e: TransitionEvent) => {
                if (e.propertyName === 'transform' || e.propertyName === 'opacity') {
                    inlineTocRender.value = true
                    shell.removeEventListener('transitionend', onEnd)
                }
            }
            shell.addEventListener('transitionend', onEnd)
            // safety fallback
            setTimeout(() => { if (!inlineTocRender.value) inlineTocRender.value = true }, 300)
        } else {
            inlineTocRender.value = true
        }
    } else {
        // start shell collapse animation; keep list mounted until animation ends
        inlineTocShellOpen.value = false
        const shell = document.querySelector('.toc-list-shell') as HTMLElement
        if (shell) {
            const onEnd = (e: TransitionEvent) => {
                if (e.propertyName === 'transform' || e.propertyName === 'opacity') {
                    inlineTocRender.value = false
                    inlineTocCollapsed.value = true
                    shell.removeEventListener('transitionend', onEnd)
                }
            }
            shell.addEventListener('transitionend', onEnd)
            // safety fallback
            setTimeout(() => { if (inlineTocRender.value) inlineTocRender.value = false; inlineTocCollapsed.value = true }, 300)
        } else {
            inlineTocRender.value = false
            inlineTocCollapsed.value = true
        }
    }
}

function updateTocVisibilityBasedOnInline() {
    const container = document.querySelector('main.main-content') as HTMLElement | null
    const inline = document.querySelector('.markdown-toc') as HTMLElement | null
    if (!container) return

    // If no inline TOC present, fall back to previous behaviour
    if (!inline) {
        showTOCandBTT.value = container.scrollTop > 300
        return
    }

    const cRect = container.getBoundingClientRect()
    const iRect = inline.getBoundingClientRect()

    // Consider inline TOC visible if any part of it intersects the container's visible area.
    const inlineVisible = (iRect.bottom > cRect.top + 8) && (iRect.top < cRect.bottom - 8)

    // Show floating TOC when inline TOC is not visible (scrolled past),
    // or when user has scrolled a fair amount (>300px) as a fallback.
    showTOCandBTT.value = !inlineVisible || container.scrollTop > 300
}

// Compute liveActiveId based on the baseline (top of visible area under nav)
function computeLiveActiveFromBaseline() {
    if (suppressObserver.value) return
    const container = document.querySelector('main.main-content') as HTMLElement | null
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    // baseline just below the nav/header; offset should match scroll offset used elsewhere
    const offset = 85 // same offset used in scrollToHeading
    const baselineY = containerRect.top + offset

    // Find heading whose top is the last one <= baselineY
    let chosen: string | null = null
    toc.value.forEach(item => {
        const el = document.getElementById(item.id)
        if (!el) return
        const r = el.getBoundingClientRect()
        if (r.top <= baselineY) {
            chosen = item.id
        }
    })

    // If none found, fallback to first heading if it is below baseline
    if (!chosen && toc.value.length) {
        const firstEl = document.getElementById(toc.value[0].id)
        if (firstEl) {
            const r = firstEl.getBoundingClientRect()
            if (r.top > baselineY) chosen = toc.value[0].id
        }
    }

    if (chosen) {
        liveActiveId.value = chosen
    }
}

function onScroll(e: Event) {
    const target = e.target as HTMLElement
    // update by inline visibility
    updateTocVisibilityBasedOnInline()
    // update liveActiveId based on baseline, unless updates are suppressed
    if (!suppressObserver.value) computeLiveActiveFromBaseline()

    // If we suppressed observer updates (due to clicking a TOC link),
    // debounce until scrolling stops and then re-enable observer updates.
    if (suppressObserver.value) {
        if (manualScrollTimer) clearTimeout(manualScrollTimer)
        manualScrollTimer = setTimeout(() => {
            suppressObserver.value = false
            manualScrollTimer = null
        }, 200)
    }
}

function scrollToTop() {
    const container = document.querySelector('main.main-content')
    if (container) {
        container.scrollTo({ top: 0, behavior: 'smooth' })
    }
}

function onFloatMouseEnter() {
    if (floatCollapseTimer) {
        clearTimeout(floatCollapseTimer)
        floatCollapseTimer = null
    }
    floatCollapsed.value = false
}

function onFloatMouseLeave() {
    if (floatCollapseTimer) clearTimeout(floatCollapseTimer)
    floatCollapseTimer = setTimeout(() => {
        floatCollapsed.value = true
    }, 1000)
}

onBeforeUnmount(() => {
    if (floatCollapseTimer) clearTimeout(floatCollapseTimer)
    if (observer) observer.disconnect()
    if (typeof window !== 'undefined') window.removeEventListener('hashchange', handleHashChange)
    const container = document.querySelector('main.main-content')
    if (container) {
        container.removeEventListener('scroll', onScroll)
    }
    if (manualScrollTimer) clearTimeout(manualScrollTimer)
    suppressObserver.value = false
})

const maxLevel = computed(() => {
    if (!toc.value.length) return 1
    return Math.max(...toc.value.map(i => i.level))
})

function lineWidth(level: number) {
    // Smooth, shorter width scaling: level 1 => longest, level max => shortest
    const max = Math.max(1, maxLevel.value)
    const maxPx = 20
    const minPx = 10
    if (max <= 1) return `${maxPx}px`
    const ratio = (max - level) / (max - 1) // 1 -> longest, 0 -> shortest
    const len = Math.round(minPx + ratio * (maxPx - minPx))
    return `${len}px`
}

function slugify(text: string) {
    if (!text) return ''
    // Keep the original heading text (trimmed) and remove HTML tags.
    // Then percent-encode so it is safe to use as an ID and in URL hash.
    let s = String(text).trim()
    s = s.replace(/<[^>]+>/g, '')
    if (!s) s = 'heading'
    try {
        return encodeURIComponent(s)
    } catch (e) {
        // Fallback: remove spaces and non-word chars
        return s.replace(/\s+/g, '-').replace(/[^\w\-\u4E00-\u9FFF]/g, '')
    }
}

function buildTocFromBlocks(blocks: Array<{ id?: string, text?: string, level?: number, content?: string, type?: string }>) {
    const itemsRaw: Array<{ id: string, text: string, level: number }> = []
    const used = new Set<string>()
    blocks.forEach((b) => {
        if (b.type === 'heading') {
            const content = (b.content || '').toString()
            const m = content.match(/^\s*(#{1,6})\s+(.*)$/)
            if (m) {
                const lvl = m[1].length
                const rawText = m[2].replace(/<[^>]+>/g, '')
                const text = rawText.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
                let id = slugify(text)
                let base = id
                let i = 1
                while (used.has(id)) id = `${base}-${i++}`
                used.add(id)
                itemsRaw.push({ id, text, level: lvl })
            }
        }
    })

    if (itemsRaw.length === 0) {
        toc.value = []
        return
    }
    const minLevel = Math.min(...itemsRaw.map(i => i.level))
    toc.value = itemsRaw.map(i => ({ id: i.id, text: i.text, level: i.level - minLevel + 1 }))
}

async function assignHeadingIds(retryCount = 0) {
    await nextTick()
    const container = document.querySelector('.markdown-body')
    if (!container) return
    
    // Select all headings
    let headings = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')) as HTMLElement[]
    
    // If no headings found, retry up to 10 times (1 sec total)
    if (headings.length === 0 && retryCount < 10) {
        setTimeout(() => assignHeadingIds(retryCount + 1), 100)
        return
    }
    
    if (headings.length === 0) return

    // match headings with toc by order and text
    let idx = 0
    headings.forEach((h) => {
        if (idx >= toc.value.length) return
        const t = h.textContent ? h.textContent.trim().replace(/\s+/g, ' ') : ''
        const tocItem = toc.value[idx]

        const match = (domText: string, itemText: string) => {
             const dt = domText.toLowerCase()
             const it = itemText.toLowerCase()
             // Use strict equality first, then loose
             return dt === it || dt.includes(it) || it.includes(dt)
        }
        
        const isMatch = (item: { text: string }) => {
            if (!item) return false
            const simple = item.text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            return match(t, item.text) || match(t, simple)
        }

        if (tocItem && isMatch(tocItem)) {
            h.id = tocItem.id
            idx++
        } else {
            // try to find a later toc item that matches
            const found = toc.value.slice(idx).find(it => isMatch(it))
            if (found) {
                h.id = found.id
                // advance idx to after found
                idx = toc.value.indexOf(found) + 1
            } else {
                // fallback slug
                h.id = slugify(t || h.innerText || 'heading')
            }
        }
    })
    setupObserver()
}

function setupObserver() {
    if (observer) observer.disconnect()
    
    // Observer options: root: null uses viewport, but if container is scroller, it's relative to viewport too
    // But root margin should account for header
    const options = {
        root: document.querySelector('main.main-content'),
        rootMargin: '-80px 0px -70% 0px', // Trigger near top
        threshold: 0
    }

    observer = new IntersectionObserver((entries) => {
        // Keep observer reserved for optional syncOnScroll behaviour only.
        // Do not update liveActiveId here; liveActiveId is computed from baseline on scroll.
        if (suppressObserver.value) return
        if (!syncOnScroll.value) return

        entries.forEach(entry => {
            if (entry.isIntersecting) {
                activeId.value = entry.target.id
            }
        })
    }, options)

    // Observe all toc headings
    toc.value.forEach(item => {
        const el = document.getElementById(item.id)
        if (el) observer?.observe(el)
    })
}

function scrollToHeading(id: string) {
    const el = document.getElementById(id)
    const container = document.querySelector('main.main-content')
    if (!el || !container) return
    
    const containerRect = container.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    const offset = 80 // Header + some padding
    
    const targetTop = container.scrollTop + (elRect.top - containerRect.top) - offset
    
    container.scrollTo({ top: targetTop, behavior: 'smooth' })

    // Temporarily suppress observer updates while smooth scrolling from a TOC click,
    // and optimistically set the active id to the clicked heading.
    suppressObserver.value = true
    if (manualScrollTimer) clearTimeout(manualScrollTimer)
    manualScrollTimer = setTimeout(() => {
        suppressObserver.value = false
        manualScrollTimer = null
    }, 1200)
    activeId.value = id
}

function onMdRendered() {
    // Ensure IDs assigned after MdParser finishes DOM work
    nextTick(() => assignHeadingIds())
    // Also ensure float TOC active item is visible
    nextTick(() => ensureFloatActiveVisible())
    // Hydrate KaTeX placeholders asynchronously (if any)
    try { nextTick(() => { try { hydrateKatexIn(document.querySelector('.markdown-body')) } catch(e) {} }) } catch(e) {}
}

function ensureFloatActiveVisible() {
    const nav = document.querySelector('.toc-float') as HTMLElement
    if (!nav) return
    const activeEl = nav.querySelector('li.active') as HTMLElement
    if (!activeEl) return

    const navRect = nav.getBoundingClientRect()
    const activeRect = activeEl.getBoundingClientRect()

    // If active element is outside visible area, scroll it into view (centered)
    if (activeRect.top < navRect.top || activeRect.bottom > navRect.bottom) {
        const target = activeEl.offsetTop - (nav.clientHeight / 2) + (activeEl.clientHeight / 2)
        try {
            nav.scrollTo({ top: target, behavior: 'smooth' })
        } catch (e) {
            nav.scrollTop = target
        }
    }
}

const postStats = computed(() => {
    if (!post.value?.content) return null
    const s = getStats(post.value.content)
    // Estimate reading time. Rough estimate: 200 words per minute average
    const readTime = Math.max(1, Math.ceil(s.wordCount / 200))
    return {
        words: s.wordCount,
        readTime
    }
})

const { locale } = useI18n()
const formatDate = (isoStr: string) => formatDateUtil(isoStr, locale.value)

onMounted(async () => {
    // Show a temporary loading title while post data is being fetched.
    try { if (typeof document !== 'undefined') document.title = `Chronicle - Loading…` } catch (e) {}
    // Mobile detection moved to global App; component no longer sets isMobile here

    // Attach scroll listener to main content
    const container = document.querySelector('main.main-content')
    if (container) {
        container.addEventListener('scroll', onScroll as EventListener)
    }

    // Register hashchange listener so anchors trigger scrollToHeading
    if (typeof window !== 'undefined') {
        window.addEventListener('hashchange', handleHashChange)
    }

    const id = route.params.id as string
    if (!id) {
        loading.value = false
        return
    }

    try {
        const res = await fetchWithAuth(`/api/post?id=${id}&t=${Date.now()}`)
        if (res.ok) {
            post.value = await res.json()
        }
    } catch(e) {
        console.error(e)
    } finally {
        loading.value = false
                // build TOC when post content available
                if (post.value && post.value.content) {
                     // parse once and reuse blocks for TOC and MdParser
                     const blocks = parseMarkdown(post.value.content)
                                         parsedBlocks.value = blocks
                                         // Render lightweight HTML immediately (no KaTeX hydration)
                                         try { plainHtml.value = convertToHtml(blocks) } catch(e) { plainHtml.value = '' }
                                         // schedule async mount of full MdParser at low priority
                                         try {
                                             const schedule = (cb: any) => { if ((window as any).requestIdleCallback) (window as any).requestIdleCallback(cb, { timeout: 300 }); else setTimeout(cb, 120) }
                                             schedule(() => { showPlain.value = false; showFullParser.value = true })
                                         } catch(e) { setTimeout(() => { showPlain.value = false; showFullParser.value = true }, 120) }
                                         buildTocFromBlocks(blocks)
                     // wait for MdParser to render DOM, then assign ids
                     nextTick(() => {
                         assignHeadingIds()
                         // Update floating TOC visibility once DOM settled
                         updateTocVisibilityBasedOnInline()
                         // initial compute of liveActiveId as well
                         computeLiveActiveFromBaseline()
                         // Handle any initial hash via centralized handler
                         try { handleHashChange() } catch (e) {}
                     })
                }
    }
})

// When active heading changes while float TOC is collapsed, ensure the active
// line is visible within the collapsed navigator.
watch([() => liveActiveId.value, () => floatCollapsed.value], ([id, collapsed]) => {
    if (!id) return
    if (collapsed) {
        nextTick(() => ensureFloatActiveVisible())
    }
})

// rebuild TOC when post content changes (e.g., reloaded)
watch(() => post.value && post.value.content, (v) => {
    if (v) {
        const blocks = parseMarkdown(v as string)
        parsedBlocks.value = blocks
        try { plainHtml.value = convertToHtml(blocks) } catch(e) { plainHtml.value = '' }
        try { const schedule = (cb: any) => { if ((window as any).requestIdleCallback) (window as any).requestIdleCallback(cb, { timeout: 300 }); else setTimeout(cb, 120) }; schedule(() => { showPlain.value = false; showFullParser.value = true }) } catch(e) { setTimeout(() => { showPlain.value = false; showFullParser.value = true }, 120) }
        buildTocFromBlocks(blocks)
        nextTick(() => assignHeadingIds())
    } else {
        toc.value = []
        parsedBlocks.value = []
    }
})
</script>

<style scoped>
.blog-post-container {
  max-width: 900px;
  margin: 0 auto;

  padding: 0 40px;
  color: var(--text-primary);
  box-sizing: border-box;
}

html:not(.is-mobile) .post-nav {
    display: flex;
    justify-content: space-between;
    padding: 30px 0;
    margin-bottom: 20px;
    align-items: center;
}

html.is-mobile .post-nav{
    padding: 15px 0!important;
}

.nav-back {
    color: var(--accent-color);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
}
.nav-back:hover {
    text-decoration: underline;
}

.nav-date {
    color: var(--component-text-secondary);
    font-size: 14px;
}

.post-header {
    margin-bottom: 40px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 20px;
}

.title {
    font-size: 2.5em;
    margin: 0 0 16px 0;
    line-height: 1.2;
    color: var(--text-primary);
}

.post-meta-info {
    margin: 16px 0;
    font-size: 14px;
    color: var(--component-text-secondary);
}

.meta-row {
    margin-bottom: 4px;
}

.separator {
    margin: 0 8px;
    color: var(--component-text-secondary);
    font-weight: 300;
}

.tags {
    display: flex;
    gap: 8px;
    margin-top: 16px;
}
.tag {
    color: var(--accent-color);
    font-size: 14px;
    cursor: pointer;
}

.tag.featured {
    color: var(--featured);
    font-weight: 600;
}

.loading, .error {
    text-align: center;
    padding: 100px;
    color: var(--component-text-secondary);
}

.toc-float{
    font-size:0.8em;
    backdrop-filter: blur(10px);
    margin-right: 10px;
}

.toc-float-item{
    margin-left: 10px;
}

.toc-float-item:hover{
    color: var(--text-primary) !important;
}
.markdown-toc {padding: 10px 14px; border: 1px solid var(--border-color); background: transparent; border-radius: 10px; margin-bottom: 24px;}
.markdown-toc .toc-list { list-style: none; padding: 0; margin: 0; }
.markdown-toc .toc-list li { margin: 1px 0; }
.markdown-toc .toc-list li a { text-decoration: none; color: var(--component-text-primary); display: block; box-sizing: border-box; }
.markdown-toc .toc-list li .toc-text { display: block; width: 100%; padding: 4px 6px 4px 6px; padding-right: 10px; box-sizing: border-box; border-radius: 6px; transition: background 0.12s, color 0.12s; }
.markdown-toc .toc-list .toc-level-1 { padding-left: 0; }
.markdown-toc .toc-list .toc-level-2 { padding-left: 8px; }
.markdown-toc .toc-list .toc-level-3 { padding-left: 16px; }
.markdown-toc .toc-list .toc-level-4 { padding-left: 24px; }
.markdown-toc .toc-list .toc-level-5 { padding-left: 32px; }
.markdown-toc .toc-list .toc-level-6 { padding-left: 40px; }
.markdown-toc .toc-list li:hover .toc-text { background: var(--component-bg-hover); color: var(--component-text-primary-hover); }
.markdown-toc .toc-list li.active .toc-text { background: var(--component-bg-active); color: var(--component-text-primary-active); font-weight: 500; }

.toc-float ul { list-style: none; margin: 0; padding: 4px }
.toc-float li { margin: 1px 0; }
.toc-float a { text-decoration: none; display: block; box-sizing: border-box; }
.toc-float .toc-text { display: block; width: 100%; padding: 3px 6px 3px 6px; padding-right: 10px; box-sizing: border-box; border-radius: 6px; transition: background 0.12s, color 0.12s; color: var(--component-text-secondary-disabled); }
.toc-float:not(.collapsed) .toc-level-1 { padding-left: 1px !important; }
.toc-float:not(.collapsed) .toc-level-2 { padding-left: 6px !important; }
.toc-float:not(.collapsed) .toc-level-3 { padding-left: 12px !important; }
.toc-float:not(.collapsed) .toc-level-4 { padding-left: 18px !important; }
.toc-float:not(.collapsed) .toc-level-5 { padding-left: 24px !important; }
.toc-float:not(.collapsed) .toc-level-6 { padding-left: 30px !important; }
.toc-float.collapsed .toc-level-1 { padding-left: 0 !important; }
.toc-float.collapsed .toc-level-2 { padding-left: 5px !important; }
.toc-float.collapsed .toc-level-3 { padding-left: 8px !important; }
.toc-float.collapsed .toc-level-4 { padding-left: 10px !important; }
.toc-float.collapsed .toc-level-5 { padding-left: 11px !important; }
.toc-float.collapsed .toc-level-6 { padding-left: 12px !important; }
.toc-float li:hover .toc-text { background: var(--component-bg-hover); color: var(--component-text-primary-hover) }
.toc-float li:active .toc-text, .toc-float li:focus .toc-text { background: var(--component-bg-active); color: var(--component-text-primary-active); }
.toc-float li.active .toc-text { background: var(--component-bg-active); color: var(--component-text-primary-active); }


/* Collapsible inline TOC header */
.toc-header { display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding: 4px; border-radius: 6px; transition: background 0.2s }
.toc-header:hover { background: var(--component-bg-hover); }
.toc-header.collapsed { justify-content: center; }
.toc-header.collapsed .toc-title { margin-right: 8px; }
.toc-title {margin-bottom:0;}

.toc-toggle-btn { background: transparent; border: none; color: var(--component-text-primary); cursor: pointer; padding: 6px; border-radius: 6px; display: flex; align-items: center; justify-content: center; }
.chev-icon { display:flex; width: 16px; height: 16px; transition: transform 0.18s; align-items: center; justify-content: center; }
.chev-icon.folded { transform: rotate(-90deg) }


/* transition for inline TOC */
.toc-expand-enter-active, .toc-expand-leave-active { transition: opacity 0.18s ease, transform 0.18s ease }
.toc-expand-enter-from, .toc-expand-leave-to { opacity: 0; transform: translateY(-6px); }
.toc-expand-enter-to, .toc-expand-leave-from { opacity: 1; transform: translateY(0); }

/* Lightweight shell that animates first; avoids heavy DOM work during animation */
.toc-list-shell { will-change: opacity, transform; transition: opacity 0.18s ease, transform 0.18s ease; overflow: hidden; }
.toc-list-shell.open { opacity: 1; transform: translateY(0); max-height: 400px; }
.toc-list-shell { opacity: 0; transform: translateY(-6px); max-height: 0; }
.toc-list { will-change: opacity, transform; }
.toc-list li { will-change: transform, opacity; }

/* Floating collapsed visual */
.toc-float { 
    right: calc(10px + 2vw); 
    position: fixed; 
    top: calc(10px + 20vh); 
    /* remove fixed bottom so height can shrink to content; constrain via max-height */
    z-index: 1199; 
    overflow-x: hidden;
    transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), background-color 0.3s ease; 
    box-sizing: border-box; 
    border-radius: 8px;
    /* Ensure toc grows to fit content but never extends past the visual bottom (80px)
       calc(100vh - top - bottom) keeps its bottom <= previous bottom value */
    max-height: calc(70vh - 80px);
    height: auto;
}
.toc-float.collapsed { overflow-y: hidden; width: 38px; padding: 4px 8px; border:none; background-color: transparent; border-radius: 10px; }
.toc-float:not(.collapsed) { overflow-y: auto; width: 220px; background-color: var(--component-bg-blur); box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 1px solid var(--border-color); }

.toc-float ul { padding: 4px; list-style: none; margin: 0; transition: padding 0.3s ease; }
.toc-float.collapsed ul {padding: 0;}

.toc-float li { display: flex; align-items: center; transition: justify-content 0.3s ease; min-height: 20px; position: relative; }
.toc-float.collapsed li { justify-content: center; margin: 0; }
.toc-float:not(.collapsed) li { justify-content: flex-start; }

.toc-link {
    display: flex;
    align-items: center;
    width: 100%;
    text-decoration: none;
    position: relative;
    /* Ensure link covers area */
    justify-content: inherit; 
}

/* When the floating TOC is collapsed we want the link to size to its content
   so the small horizontal bar can be placed at the far right via the parent
   flex container. Override the default full width here. */
.toc-float.collapsed .toc-link {
    width: 100%;
    padding: 0;
}

/* Line style (collapsed state) */
.toc-float .toc-line { 
    display:block; 
    height:3px; 
    background: var(--border-color-blur); 
    border-radius:1.5px; 
    transition: opacity 0.2s ease, transform 0.3s ease, background-color 0.3s ease; 
    position: absolute;
    right: 0;
    width: 100% !important;
}

/* Expanded State: Hide Line */
.toc-float:not(.collapsed) .toc-line {
    opacity: 0;
    transform: translateX(10px);
    pointer-events: none;
}

/* Collapsed State: Show Line */
.toc-float.collapsed .toc-line {
    opacity: 1;
    transform: translateX(0);
    position: relative; /* In flow when collapsed */
    /* ensure the small bar hugs its content and doesn't stretch
       or offset from the right due to the full-width link */
    margin: 0;
}

/* Active State for Line */
.toc-float li.active .toc-line {
    background: var(--component-text-primary-active);
    box-shadow: 0 0 4px color-mix(in srgb, var(--component-text-primary-active) 70%, transparent), 0 0 8px color-mix(in srgb, var(--component-text-primary) 20%, transparent);
    filter: drop-shadow(0 0 3px color-mix(in srgb, var(--component-text-primary-active) 45%, transparent));
    transition: box-shadow 0.18s ease, background 0.18s ease, filter 0.18s ease;
}
.toc-float li:hover .toc-line { background: var(--component-text-primary-hover); }


/* Text style (expanded state) */
.toc-float .toc-text { 
    display: block; 
    width: 100%; 
    padding: 3px 6px; 
    padding-right: 10px; 
    box-sizing: border-box; 
    border-radius: 6px; 
    color: var(--component-text-secondary); 
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: opacity 0.2s ease, transform 0.3s ease, background-color 0.2s, color 0.2s;
}

/* Collapsed State: Hide Text */
.toc-float.collapsed .toc-text { 
    opacity: 0;
    transform: translateX(10px);
    position: absolute; /* Take out of flow */
    pointer-events: none;
}

/* expanded scrollbar styling */
.toc-float:not(.collapsed)::-webkit-scrollbar { width: 6px; }
.toc-float:not(.collapsed)::-webkit-scrollbar-thumb { background: var(--component-bg-hover); border-radius: 3px; }
.toc-float:not(.collapsed)::-webkit-scrollbar-track { background: transparent; }

/* Expanded State: Show Text */
.toc-float:not(.collapsed) .toc-text {
    opacity: 1;
    transform: translateX(0);
}

/* Hover/Active states for Text */
.toc-float:not(.collapsed) li:hover .toc-text { background: var(--component-bg-hover); color: var(--component-text-primary-hover) }
.toc-float:not(.collapsed) li.active .toc-text { background: var(--component-bg-active); color: var(--component-text-primary-active); font-weight: 500; }

/* mobile TOC styles moved to global stylesheet */
</style>