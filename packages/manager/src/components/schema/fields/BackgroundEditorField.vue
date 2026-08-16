<template>
  <div class="form-row">
    <label v-if="label">{{ label }}</label>
    <div style="display:flex; gap:8px; align-items:center; margin: 8px 0;">
      <video v-if="previewVideoUrl" class="bg-preview bg-preview-video" :src="previewVideoUrl" muted playsinline preload="metadata"></video>
      <div v-else-if="previewUrl" class="bg-preview" :style="{ backgroundImage: `url(${previewUrl})` }"></div>
      <button class="secondary" @click.prevent="openEditor">{{ hasMedia ? editLabel||t('backgroundEditor.edit') : addLabel||t('backgroundEditor.add') }}</button>
      <button v-if="hasMedia" class="secondary" @click.prevent="clearBg">{{clearLabel||t('backgroundEditor.delete') }}</button>
    </div>
  </div>

  <BackgroundEditorModal
    v-if="bgEditorOpen"
    :url="backgroundUrl"
    :video-url="backgroundVideoUrl"
    :initial="backgroundMeta"
    :source-path="backgroundSourcePath"
    :source-name="backgroundSourceName"
    :allow-video="allowVideo"
    @save="onBgSave"
    @close="bgEditorOpen = false"
  />
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import BackgroundEditorModal from '../../BackgroundEditorModal.vue'
import { useI18n } from 'vue-i18n'
import { resolveMediaUrl, isVideoFile, triggerVideoConversionTask } from '../../../utils/backgroundSettings'
import { readYaml, writeText, deleteFile } from '../../../data/dataAccess'

const { t }= useI18n()

const props = defineProps<{
  modelValue: Record<string, any> | string
  schema: Record<string, any>
  label?: string
  meta?: any
  sourcePath?: string
  sourceName?: string
  addLabel?: string
  editLabel?: string
  clearLabel?: string
  /** Video backgrounds are a frontend (site) feature only — the CMS's own
   *  editor background stays image-only. */
  allowVideo?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: any]
  'update:meta': [value: any]
}>()

const bgEditorOpen = ref(false)
const internalUrl = ref(typeof props.modelValue === 'string' ? props.modelValue : props.modelValue?.url || '')
const internalVideoUrl = ref('')
const internalMeta = ref(props.meta || null)
const internalSourcePath = ref(props.sourcePath || '')
const internalSourceName = ref(props.sourceName || '')
const initialized = ref(false)

// On mount: auto-discover background from data/background/ directory
onMounted(async () => {
  try {
    // Read metadata from background.yml
    const bgYml = await readYaml<Record<string, any>>('data/background/background.yml')
    if (bgYml) {
      internalMeta.value = bgYml
      emit('update:meta', bgYml)
    }
    // Auto-discover image + video (both live in data/background/)
    const { readDir } = await import('../../../data/dataAccess')
    const files = await readDir('data/background')
    const imgs = files.filter((f: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f) && !f.startsWith('.') && !/_alt\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f))
    if (imgs.length > 0 && !internalUrl.value) {
      internalUrl.value = `/data/background/${imgs[0]}`
      emit('update:modelValue', internalUrl.value)
    }
    const vids = files.filter((f: string) => isVideoFile(f) && !f.startsWith('.'))
    if (vids.length > 0 && !internalVideoUrl.value) {
      internalVideoUrl.value = `/data/background/${vids[0]}`
    }
  } catch {} finally { initialized.value = true }
})

// Sync from props (schema form may load stale data from site.yml — ignore after init)
watch(() => props.modelValue, (v) => {
  if (initialized.value) return // ignore schema form data after our own init
  const url = typeof v === 'string' ? v : v?.url || ''
  if (url) internalUrl.value = url
})
watch(() => props.meta, (v) => {
  if (initialized.value) return
  if (v) internalMeta.value = v
})
watch(() => props.sourcePath, (v) => { if (v) internalSourcePath.value = v })
watch(() => props.sourceName, (v) => { if (v) internalSourceName.value = v })

const backgroundUrl = computed(() => internalUrl.value)
const backgroundVideoUrl = computed(() => internalVideoUrl.value)
const backgroundMeta = computed(() => internalMeta.value)
const backgroundSourcePath = computed(() => internalSourcePath.value)
const backgroundSourceName = computed(() => internalSourceName.value)
const previewUrl = computed(() => resolveMediaUrl(internalUrl.value))
const previewVideoUrl = computed(() => resolveMediaUrl(internalVideoUrl.value))
const hasMedia = computed(() => !!(previewUrl.value || previewVideoUrl.value))
const allowVideo = computed(() => props.allowVideo === true)

function openEditor() { bgEditorOpen.value = true }

async function clearBg() {
  // Delete ALL background image + video files from data/background/
  await deleteExistingImages()
  await deleteExistingVideos()
  internalUrl.value = ''
  internalVideoUrl.value = ''
  internalMeta.value = {}
  internalSourcePath.value = ''
  internalSourceName.value = ''
  emit('update:modelValue', '')
  emit('update:meta', {})
  await persistBg('')
}

async function copyMediaToBackground(src: string, ext: string): Promise<string> {
  const dest = 'data/background/background' + ext
  try {
    const isElec = typeof window !== 'undefined' && !!(window as any).chronicleElectron?.isElectron
    if (isElec) {
      const bridge = (window as any).chronicleElectron
      const ok = await bridge.copyFile(src.replace(/^\//, ''), dest)
      return ok ? '/data/background/background' + ext : ''
    } else {
      const resp = await fetch('/api/copy-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: src, dest }),
      })
      return resp.ok ? '/data/background/background' + ext : ''
    }
  } catch (e) {
    console.error('[BackgroundEditorField] copyFile failed:', e)
    return ''
  }
}

async function deleteExistingVideos() {
  await deleteVideosExcept('')
}

/** Delete background videos except the one at `keepUrl` (empty = delete all). */
async function deleteVideosExcept(keepUrl: string) {
  try {
    const { readDir } = await import('../../../data/dataAccess')
    const files = await readDir('data/background')
    const keepName = keepUrl.split('/').pop() || ''
    const vids = files.filter((f: string) => isVideoFile(f) && !f.startsWith('.') && f !== keepName)
    for (const v of vids) {
      try { await deleteFile(`data/background/${v}`) } catch {}
    }
  } catch {}
}

async function deleteExistingImages() {
  try {
    const { readDir } = await import('../../../data/dataAccess')
    const files = await readDir('data/background')
    const imgs = files.filter((f: string) => /\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f) && !f.startsWith('.') && !/_alt\.(jpg|jpeg|png|gif|webp|avif|svg)$/i.test(f))
    for (const v of imgs) {
      try { await deleteFile(`data/background/${v}`) } catch {}
    }
  } catch {}
}

async function onBgSave(m: any) {
  const url = m.url || ''
  const videoUrl = m.videoUrl || ''
  internalMeta.value = m
  if (m.sourcePath !== undefined) {
    internalSourcePath.value = m.sourcePath
    internalSourceName.value = m.sourceName || ''
  }
  bgEditorOpen.value = false

  // 图片/视频互斥：背景要么是图要么是视频，选其一就清掉另一个（含落盘文件）。
  // 这样「用视频覆盖背景图片」后，原来那张图会被真正删除，而不是残留。
  if (videoUrl) {
    // 选择视频：先原样复制到 canonical background.mp4（快、立刻有可用背景），
    // 再 fire-and-forget 异步压缩 + 抽首帧（进通知中心，成功静默替换，失败报错 + 重试）。
    await deleteExistingImages()
    let finalVideo = videoUrl
    if (!videoUrl.startsWith('/data/background/background.')) {
      const copiedUrl = await copyMediaToBackground(videoUrl, '.mp4')
      if (copiedUrl) finalVideo = copiedUrl
      else {
        console.warn('[BackgroundEditorField] copyFile returned false — video NOT copied to data/background/')
        finalVideo = videoUrl
      }
    }
    await deleteVideosExcept(finalVideo)
    internalVideoUrl.value = finalVideo
    internalUrl.value = ''
    triggerVideoConversionTask(finalVideo, t)
  } else if (url) {
    // 选择图片 → 清除旧视频；若新图片在目录外，再替换旧图片后复制。
    await deleteExistingVideos()
    if (url.startsWith('/data/background/')) {
      internalUrl.value = url
    } else {
      await deleteExistingImages()
      const ext = (url.match(/\.\w+$/)?.[0]) || '.jpg'
      const copiedUrl = await copyMediaToBackground(url, ext)
      if (copiedUrl) internalUrl.value = copiedUrl
      else {
        console.warn('[BackgroundEditorField] copyFile returned false — image NOT copied to data/background/')
        internalUrl.value = url
      }
    }
    internalVideoUrl.value = ''
  } else {
    // 两者皆空 → 清空背景。
    await deleteExistingImages()
    await deleteExistingVideos()
    internalUrl.value = ''
    internalVideoUrl.value = ''
  }

  emit('update:modelValue', internalUrl.value)
  emit('update:meta', internalMeta.value)
  await persistBg(internalUrl.value)
}

async function persistBg(url: string) {
  // 合并写 data/background/background.yml：保留非组件字段（frontendBackgroundColorLight/Dark，
  // 由 useSchemaForm 的 x-file 写入）与手写注释；mode/blur 等组件 meta 更新。
  const meta = internalMeta.value || {}
  const { mode, posX, posY, size, blur, overlayLightColor, overlayLightOpacity, overlayDarkColor, overlayDarkOpacity, videoAutoplay, videoLoop, videoPlaybackRate } = meta
  try {
    const { readYaml, writeYaml } = await import('../../../data/dataAccess')
    const existing = (await readYaml<Record<string, any>>('data/background/background.yml')) || {}
    await writeYaml('data/background/background.yml', {
      ...existing,
      mode: mode || 'cover',
      posX: posX ?? 50,
      posY: posY ?? 50,
      size: size ?? 100,
      blur: blur ?? 0,
      overlayLightColor: overlayLightColor || '#ffffff',
      overlayLightOpacity: overlayLightOpacity ?? 0,
      overlayDarkColor: overlayDarkColor || '#000000',
      overlayDarkOpacity: overlayDarkOpacity ?? 0,
      videoAutoplay: videoAutoplay !== false,
      videoLoop: videoLoop !== false,
      videoPlaybackRate: Number(videoPlaybackRate ?? 1) || 1,
    })
  } catch (e) { console.error('[BackgroundEditorField] persistBg failed', e) }
}
</script>

<style scoped>
.bg-preview {
  width: 100px;
  height: 60px;
  background-size: cover;
  background-position: center;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.bg-preview-video {
  object-fit: cover;
  background: transparent;
}
</style>
