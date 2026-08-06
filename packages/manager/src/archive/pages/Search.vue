<template>
  <div class="page-container" :class="{ 'centered-mode': !isSearchActive && !isTagCloudOpen }">
    <div class="search-box-wrapper">
      <div class="search-box">
        <!-- Tag Trigger -->
        <button 
           class="tag-trigger" 
           :class="{ active: selectedTags.length > 0 || isTagCloudOpen }" 
              @click="isTagCloudOpen = !isTagCloudOpen"
              :title="t('search.selectTags')"
        >
          <span v-html="Icons.hash" class="icon"></span>
        </button>

        <span class="divider"></span>
        <!-- Input Area -->
        <div class="input-area" @click="focusInput">
              <div v-for="tag in sortTags(selectedTags)" :key="tag" class="selected-tag-chip" :class="{featured: tag === 'featured'}">
                  <span class="chip-text">{{ tag === 'featured' ? t('tag.featured') : tag }}</span>
              <button class="chip-remove" :class="{featured: tag === 'featured'}" @click.stop="removeTag(tag)">
                 <span v-html="Icons.cross" class="icon-sm"></span>
              </button>
           </div>
              <input 
                  ref="searchInput"
                  type="text" 
                  v-model="searchQuery" 
                  :placeholder="t('search.placeholder')" 
                  class="search-input" 
              />
        </div>
      </div>
    </div>

    <!-- Content Area: Tag Cloud OR Results -->
    <Transition name="fade">
      <div class="content-wrapper" v-if="isSearchActive || isTagCloudOpen">
        <div class="content-scroll-area">
            <!-- Tag Cloud -->
            <div v-if="isTagCloudOpen" class="tag-cloud-container">
            <!-- No title, just content -->
            <div class="tags-grid">
                <button 
                    v-for="tagData in allTagData" 
                    :key="tagData.name" 
                    class="tag-cloud-item" 
                    :class="{ selected: selectedTags.includes(tagData.name), featured: tagData.name === 'featured' }"
                    @click="toggleTagAndKeepOpen(tagData.name)"
                >
                        {{ tagData.name === 'featured' ? $t('tag.featured') : tagData.name }}
                    <span class="tag-count">{{ tagData.count }}</span>
                </button>
            </div>
            <div v-if="allTagData.length === 0" class="no-tags">{{ $t('search.noTags') }}</div>
            
                        <div class="cloud-actions">
                            <button class="close-cloud-btn" @click="isTagCloudOpen = false">{{ $t('search.done') }}</button>
                        </div>
          </div>

          <!-- Search Results -->
          <div v-else class="results-list">
                            <div v-if="loading" class="loading">{{ $t('search.loading') }}</div>
                            <div v-else-if="filteredPosts.length === 0" class="empty">
                                {{ $t('search.noResults') }}
                            </div>
              <article 
                v-for="post in filteredPosts" 
                :key="post.id" 
                class="result-card" 
                @click="openPost(post.id)"
              >
                <div class="post-header">
                    <h3 class="post-title">{{ post.title }}</h3>
                    <span class="post-date">{{ formatDate(post.date) }}</span>
                </div>
                <div class="post-tags" v-if="post.tags && post.tags.length">
                    <span v-for="tag in sortTags(post.tags)" :key="tag" class="tag-display" :class="{ featured: tag === 'featured' }">#{{ tag === 'featured' ? t('tag.featured') : tag }}</span>
                </div>
                <div class="post-summary">{{ post.summary }}</div>
              </article>
              <div class="list-spacer"></div>
          </div>
      </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { fetchWithAuth } from '../../utils/fetchWithAuth';
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Icons } from '../utils/icons'
import { debounce } from '../utils/debounce'
import { sortTags } from '../utils/tagUtils'
interface Post {
  id: string
  title: string
  date: string
  summary: string
  tags?: string[]
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const posts = ref<Post[]>([])
const loading = ref(true)
const searchQuery = ref('')
const debouncedSearchQuery = ref('')
const selectedTags = ref<string[]>([])
const isTagCloudOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)

// Update debounced query with delay
watch(searchQuery, debounce((newVal: string) => {
    debouncedSearchQuery.value = newVal
    if (newVal.trim()) {
        document.title = `Search: ${newVal} - Chronicle`
    } else {
        document.title = 'Search - Chronicle'
    }
}, 300))

const isSearchActive = computed(() => {
    return debouncedSearchQuery.value.trim().length > 0 || selectedTags.value.length > 0
})

const allTagData = computed(() => {
    const counts = new Map<string, number>()
    posts.value.forEach(p => {
        if (p.tags) {
            p.tags.forEach(t => {
                counts.set(t, (counts.get(t) || 0) + 1)
            })
        }
    })
    
    // Convert to array and sort alphabetically
    return Array.from(counts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
            if (a.name === 'featured') return -1;
            if (b.name === 'featured') return 1;
            return a.name.localeCompare(b.name);
        })
})

const filteredPosts = computed(() => {
    // Determine active query source - if tags selected, we might filter immediately, 
    // but for text, use debounced.
    // Actually, tags affect immediately. Text affects debounced.
    
    return posts.value.filter(post => {
        // 1. Title Match (Use Debounced)
        const matchesTitle = post.title.toLowerCase().includes(debouncedSearchQuery.value.toLowerCase())
        
        // 2. Tag Match (Use Immediate)
        let matchesTags = true
        if (selectedTags.value.length > 0) {
            const tempTags = post.tags || []
            matchesTags = selectedTags.value.every(t => tempTags.includes(t))
        }

        return matchesTitle && matchesTags
    })
})

const toggleTagAndKeepOpen = (tag: string) => {
    if (selectedTags.value.includes(tag)) {
        selectedTags.value = selectedTags.value.filter(t => t !== tag)
    } else {
        selectedTags.value.push(tag)
    }
}

const removeTag = (tag: string) => {
    selectedTags.value = selectedTags.value.filter(t => t !== tag)
}

const focusInput = () => {
    searchInput.value?.focus()
}

const openPost = (id: string) => {
    router.push(`/post/${id}`)
}

const formatDate = (isoStr: string) => {
  if (!isoStr) return ''
  return new Date(isoStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

onMounted(async () => {
    try {
        const res = await fetchWithAuth(`/api/posts?t=${Date.now()}`)
        if (res.ok) {
            posts.value = await res.json()
        }
    } catch (e) {
        console.error(e)
    } finally {
        loading.value = false
    }
    // 读取query参数
    const { tags, title } = route.query;
    // tags赋值到selectedTags，支持数组或字符串
    if (tags) {
        if (Array.isArray(tags)) {
            selectedTags.value = tags.filter((t): t is string => t !== null);
        } else {
            selectedTags.value = [tags as string];
        }
    }
    // title赋值到searchQuery
    if (title) {
        searchQuery.value = String(title);
    }
    // 替换地址栏，去除query参数
    if (tags || title) {
        router.replace('/search');
    }
})
</script>

<style scoped>
.page-container {
  max-width: 800px;
  max-height: calc(100vh - 70px);
  margin: 0 auto;
  padding: 15vh 20px 0;
  color: var(--text-primary);
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  position: relative;
}

/* Centered Mode */
.page-container.centered-mode .search-box-wrapper {
    transform: translateY(20vh);
}

/* Search Box */
.search-box-wrapper {
    flex-shrink: 0;
    margin-bottom: 2rem;
    z-index: 50;
    width: 100%;
    transition: transform 0.6s cubic-bezier(0.19, 1, 0.22, 1);
}

/* Results Fade Transition */
.fade-enter-active {
  transition: opacity 0.6s ease 0.5s;
}
.fade-leave-active {
  transition: opacity 0.1s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.search-box {
    display: flex;
    align-items: center;
    background: var(--component-bg-blur-alt);
    border: 1px solid var(--border-color-blur);
    border-radius: 12px;
    padding: 4px;
    transition: box-shadow 0.3s ease;
}
.search-box:focus-within {
    border-color: var(--accent-color);
    box-shadow: 0 0 0 2px var(--component-bg-accent-blur);
}

.tag-trigger {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 8px 12px;
    color: var(--component-text-secondary);
    display: flex;
    align-items: center;
    transition: color 0.3s ease;
    flex-shrink: 0;
}
.tag-trigger.active {
    color: var(--accent-color);
}
.tag-trigger:hover {
    color: var(--accent-color);
}

.input-area {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 4px 10px;
    gap: 6px;
    cursor: text;
}

.selected-tag-chip {
    display: inline-flex;
    align-items: center;
    background: var(--component-bg-accent-blur);
    color: var(--accent-color);
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.9rem;
}

.selected-tag-chip.featured{
    background: var(--featured-bg);
    color: var(--featured);
    font-weight: 600;
}
.chip-remove {
    background: transparent;
    border: none;
    color: var(--component-text-primary-hover);
    cursor: pointer;
    padding: 0;
    margin-left: 6px;
    display: flex;
    align-items: center;
    opacity: 0.7;
}
.chip-remove.featured {
    color: var(--featured);
}
.chip-remove:hover {
    opacity: 1;
}

.search-input {
    flex: 1;
    min-width: 120px;
    background: transparent;
    border: none;
    color: var(--text-primary);
    font-size: 1rem;
    padding: 6px 0;
    outline: none;
}

/* Content Area Wrapper */
.content-wrapper {
    flex: 1;
    min-height: 0; 
    margin-bottom: 10vh;
    position: relative;
    /* Blur mask */
    mask-image: linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent);
    -webkit-mask-image: linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent);
}

.content-scroll-area {
    height: 100%;
    overflow-y: auto;
    padding-top: 20px;
    padding-bottom: 20px;
    scrollbar-width: none; 
    -ms-overflow-style: none;
}
.content-scroll-area::-webkit-scrollbar { 
    display: none; 
}

/* Tag Cloud Overlay */
.tag-cloud-container {
    background: transparent; /* Removed background */
    border: none; /* Removed border */
    padding: 0; /* Align with content area */
    animation: fadeIn 0.2s ease;
    display: flex;
    flex-direction: column;
    min-height: 100%;
}
.tags-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center; /* Scattered feel */
    align-content: flex-start;
    flex: 1;
}
.tag-cloud-item {
    background: var(--component-bg-blur);
    color: var(--component-text-secondary);
    border: 1px solid var(--border-color);
    padding: 6px 14px;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}
.tag-cloud-item:hover {
    background: var(--component-bg-hover);
    color: var(--component-text-primary-hover);
}
.tag-cloud-item.selected {
    background: var(--accent-color);
    color: var(--recommended-accent-text);
    border-color: var(--component-bg-accent);
}
.tag-cloud-item.featured {
    color: var(--featured);
    font-weight: 600;
}

.tag-cloud-item.featured:hover {
    background: var(--featured-bg);
    color: var(--featured);
    border-color: var(--featured);
}

.tag-cloud-item.featured.selected {
    background: var(--featured);
    border-color: var(--featured);
    color: var(--app-bg-primary);
}

.tag-count {
    font-size: 0.75em;
    opacity: 0.7;
    background: transparent;
    padding: 0;
    border-radius: 4px;
    min-width: 14px;
    text-align: center;
}

.cloud-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 2rem;
    padding-bottom: 1rem;
}
.close-cloud-btn {
    background: var(--accent-color);
    color: var(--recommended-accent-text);
    border: none;
    padding: 8px 24px;
    border-radius: 4px;
    margin-bottom: 20px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.2s ease;
}
.close-cloud-btn:hover {
    background: var(--component-bg-accent-hover);
}

/* Results */
.results-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.result-card {
    background: var(--component-bg-blur-alt);
    border: 1px solid var(--border-color);
    padding: 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.2s ease;
}
.result-card:hover {
    background: var(--component-bg-hover);
    border-color: var(--component-text-primary-hover);
}
.post-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
}
.post-title {
    margin: 0;
    font-size: 1.2rem;
    color: var(--text-primary);
}
.post-date {
    font-size: 0.9rem;
    color: var(--component-text-secondary);
}
.post-tags {
    margin-bottom: 8px;
}
.tag-display {
    color: var(--accent-color);
    font-size: 0.85rem;
    margin-right: 10px;
}
.tag-display.featured {
    color: var(--featured);
}
.post-summary {
    color: var(--component-text-secondary);
    font-size: 0.95rem;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.icon {
    width: 24px;
    height: 24px;
    display: block;
}
.icon-sm {
    width: 16px;
    height: 16px;
    display: block;
    /* Ensure small icons are sized correctly */
}
.icon-sm :deep(svg) {
    width: 16px;
    height: 16px;
}

.empty, .loading {
    text-align: center;
    color: var(--component-text-secondary);
    padding: 2rem;
}


.divider {
  width: 1px;
  height: 28px;
    background-color: var(--border-color-blur);
  margin: 0 2px;
}

.list-spacer {
    height: 40px; 
    width: 100%;
    flex-shrink: 0;
}

@keyframes fadeIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
}
</style>