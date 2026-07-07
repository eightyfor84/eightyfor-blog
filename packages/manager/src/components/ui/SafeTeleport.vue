<template>
  <Teleport :to="to" :disabled="!targetReady">
    <span v-if="targetReady" style="display:contents"><slot /></span>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps<{ to: string }>()

const targetReady = ref(false)
let observer: MutationObserver | null = null

function check() {
  const id = props.to.startsWith('#') ? props.to.slice(1) : props.to
  targetReady.value = !!document.getElementById(id)
}

onMounted(() => {
  check()
  // Watch for late-mounted targets (e.g. hot reload, async components)
  if (!targetReady.value) {
    observer = new MutationObserver(() => {
      check()
      if (targetReady.value) observer?.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  observer = null
})
</script>
