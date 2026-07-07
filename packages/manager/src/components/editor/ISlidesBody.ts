import type { Ref } from 'vue'
import type { IEditorBody } from './IEditorBody'

export interface ISlidesBody extends IEditorBody {
  readonly previewMode: Ref<'single' | 'all'>
  readonly showThumbnailsLocal: Ref<boolean>
  handleToolAction: (action: string) => void
}
