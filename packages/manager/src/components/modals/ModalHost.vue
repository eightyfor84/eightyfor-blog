<template>
  <Teleport to="body">
    <template v-for="(entry, index) in modalStack" :key="index">
      <div v-if="index === modalStack.length - 1">
        <component
          :is="entry.component"
          v-bind="entry.props"
          @resolve="(val: any) => handleResolve(index, val)"
          @close="() => handleClose(index)"
        />
      </div>
    </template>
  </Teleport>
</template>

<script setup lang="ts">
import { useModal } from '../../composables/editor/core/useModalStack'

defineOptions({ inheritAttrs: false })

const { modalStack } = useModal()

function handleResolve(index: number, value: any) {
  // The modal component emitted 'resolve' — the parent composable handles
  // closing and resolution through closeModal
  const { closeModal } = useModal()
  closeModal(value)
}

function handleClose(index: number) {
  const { closeModal } = useModal()
  closeModal(null)
}
</script>
