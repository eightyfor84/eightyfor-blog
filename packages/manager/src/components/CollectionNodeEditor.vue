<template>
  <ul class="collection-tree" :class="{ nested: depth > 0 }">
    <li v-for="(node, idx) in nodes" :key="node._localId || idx">
      <div class="node-row">
        <select v-model="node.type" class="node-type" @change="onTypeChange(node)" :disabled="isTypeLocked(node)">
          <option value="post">Post</option>
          <option value="group">Group</option>
        </select>

        <template v-if="node.type === 'post'">
          <PostIdPicker
            :modelValue="node.id"
            @update:modelValue="(val) => onPickerUpdate(node, val)"
          />
        </template>
        <template v-else>
          <input v-model="node.title" placeholder="Group title" class="node-title" />
        </template>

        <div class="node-actions">
          <button v-if="node.type === 'group'" class="action-btn action-add icon-only" aria-label="新增子节点" title="新增子节点" @click="addChild(node)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
          <button class="action-btn action-delete icon-only" aria-label="删除节点" title="删除节点" @click="removeNode(idx)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      <CollectionNodeEditor
        v-if="node.type === 'group' && Array.isArray(node.children) && node.children.length > 0"
        :nodes="node.children"
        :depth="depth + 1"
        :onPostPicked="props.onPostPicked"
      />
    </li>
  </ul>
</template>

<script setup lang="ts">
import PostIdPicker from './PostIdPicker.vue'

defineOptions({ name: 'CollectionNodeEditor' })

const props = withDefaults(defineProps<{
  nodes: any[]
  depth?: number
  onPostPicked?: (node: any, id: string) => void
}>(), {
  depth: 0,
})

function makeId() { return 'n_' + Math.random().toString(36).slice(2, 9) }

function addChild(parent: any) {
  if (parent?.type !== 'group') return
  parent.children = parent.children || []
  parent.children.push({ _localId: makeId(), id: '', type: 'post' })
}

function onTypeChange(node: any) {
  if (node?.type !== 'group' && Array.isArray(node?.children)) {
    node.children = []
  }
}

function isTypeLocked(node: any) {
  if (!node) return false
  if (node.type === 'group') {
    // group locked if has children
    return Array.isArray(node.children) && node.children.length > 0
  }
  if (node.type === 'post') {
    // post locked if has an id
    return !!String(node.id || '').trim()
  }
  return false
}

function removeNode(idx: number) {
  if (!Array.isArray(props.nodes)) return
  props.nodes.splice(idx, 1)
}

function onPickerUpdate(node: any, val: any) {
  let id = ''
  if (!val) id = ''
  else if (typeof val === 'string') id = val
  else if (typeof val === 'object' && val.id) id = String(val.id)
  else id = ''

  node.id = id

  try {
    if (typeof props.onPostPicked === 'function') props.onPostPicked(node, id)
  } catch (e) {}
}
</script>

<style scoped>
.collection-tree {
  list-style: none;
  margin: 0;
  padding: 0;
}

.collection-tree.nested {
  margin-left: 18px;
}

.node-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px;
  border-radius: 6px;
}

.node-type {
  width: 86px;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.node-title {
  flex: 1 1 auto;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
}

.node-actions {
  display: flex;
  gap: 6px;
}

.action-btn {
  height: 30px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 0;
  cursor: pointer;
  transition: color .15s ease, background .15s ease, transform .08s ease;
}

.action-btn:hover {
  color: var(--text-primary);
  background: var(--component-bg-hover);
}

.action-btn.icon-only {
  width: 30px;
  min-width: 30px;
}

.action-btn.icon-only svg {
  width: 18px;
  height: 18px;
  display: block;
}

.action-delete {
  color: var(--status-error);
  background: transparent;
}

.action-delete:hover {
  background: var(--code-bg);
  color: var(--status-error);
}
</style>
