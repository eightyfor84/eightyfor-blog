import { reactive } from 'vue'

export type MathTooltipOnSave = (tex: string, uniqueId: string, blockIndex: number) => void

export interface MathTooltipState {
  visible: boolean
  x: number
  y: number
  tex: string
  originalTex: string
  uniqueId: string
  blockIndex: number
  copied: boolean
  timer: number | null
  isEditing: boolean
  error: string
  onSave: MathTooltipOnSave | null
}

const state = reactive<MathTooltipState>({
  visible: false,
  x: 0,
  y: 0,
  tex: '',
  originalTex: '',
  uniqueId: '',
  blockIndex: -1,
  copied: false,
  timer: null,
  isEditing: false,
  error: '',
  onSave: null
})

export interface MathTooltipShowOpts {
  x?: number
  y?: number
  tex?: string
  originalTex?: string
  uniqueId?: string
  blockIndex?: number
  isEditing?: boolean
  onSave?: MathTooltipOnSave | null
}

function show(opts: MathTooltipShowOpts = {}) {
  if (opts.tex !== undefined) state.tex = opts.tex
  if (opts.originalTex !== undefined) state.originalTex = opts.originalTex
  if (opts.uniqueId !== undefined) state.uniqueId = opts.uniqueId
  if (opts.blockIndex !== undefined) state.blockIndex = opts.blockIndex
  if (opts.x !== undefined) state.x = opts.x
  if (opts.y !== undefined) state.y = opts.y
  if (opts.isEditing !== undefined) state.isEditing = opts.isEditing
  if (opts.onSave !== undefined) state.onSave = opts.onSave
  state.copied = false
  state.error = ''
  state.visible = true
}

function hide() { state.visible = false }

export function useMathTooltip() {
  return { state, show, hide }
}

export default useMathTooltip
