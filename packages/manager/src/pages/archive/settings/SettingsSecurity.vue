<template>
  <div>
    <!-- Reuse original security page content here -->
    <component :is="SecurityComp" />
  </div>
</template>

<script setup lang="ts">
import SecurityComp from '../Security.vue'
</script>

<style scoped>
</style>
