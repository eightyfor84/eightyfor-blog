import { reactive } from 'vue'

export interface PreviewFile {
  name: string
  path: string
  type: string
}

const state = reactive({
  visible: false,
  file: null as PreviewFile | null,
  // Image mode
  mode: 'file' as 'file' | 'image',
  imageSrc: '',
})

// Image zoom/pan state
const imgState = reactive({
  scale: 1,
  x: 0,
  y: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
})

function resetImgState() {
  imgState.scale = 1
  imgState.x = 0
  imgState.y = 0
  imgState.isDragging = false
}

export function usePreview() {
  function openPreview(file: PreviewFile) {
    state.file = file
    state.mode = 'file'
    state.imageSrc = ''
    state.visible = true
  }

  function openImagePreview(src: string) {
    state.imageSrc = src
    state.mode = 'image'
    state.file = null
    state.visible = true
    resetImgState()
  }

  function closePreview() {
    state.visible = false
    state.file = null
    state.imageSrc = ''
    state.mode = 'file'
    resetImgState()
  }

  return {
    state,
    imgState,
    openPreview,
    openImagePreview,
    closePreview,
    resetImgState,
  }
}
