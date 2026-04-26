<script setup lang="ts">
import { ref } from 'vue'

interface SampleTab {
  id: string
  name: string
}

const props = defineProps<{
  samples: SampleTab[]
  activeSampleId: string
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'add'): void
  (e: 'remove', id: string): void
  (e: 'rename', id: string, name: string): void
}>()

const editingId = ref<string | null>(null)
const tempName = ref('')

const startRename = (sample: SampleTab) => {
  editingId.value = sample.id
  tempName.value = sample.name
}

const finishRename = (sample: SampleTab) => {
  if (editingId.value === sample.id) {
    const trimmed = tempName.value.trim()
    if (trimmed && trimmed !== sample.name) {
      emit('rename', sample.id, trimmed)
    }
    editingId.value = null
  }
}

// Custom directive to focus the input
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}
</script>

<template>
  <div class="sample-tabs">
    <div 
      v-for="sample in props.samples" 
      :key="sample.id"
      class="sample-tab"
      :class="{ 'sample-tab--active': props.activeSampleId === sample.id }"
      @click="emit('select', sample.id)"
    >
      <div class="sample-tab__content">
        <input
          v-if="editingId === sample.id"
          v-model="tempName"
          class="sample-tab__input"
          @blur="finishRename(sample)"
          @keyup.enter="finishRename(sample)"
          @click.stop
          v-focus
        />
        <template v-else>
          <span class="sample-tab__name">{{ sample.name }}</span>
          <button 
            class="sample-tab__edit-btn" 
            title="Rename sample"
            @click.stop="startRename(sample)"
          >
            ✎
          </button>
        </template>
      </div>

      <button 
        v-if="props.samples.length > 1"
        class="sample-tab__close" 
        @click.stop="emit('remove', sample.id)"
      >
        ×
      </button>
    </div>
    <button class="add-sample-btn" title="Add new sample" @click="emit('add')">+</button>
  </div>
</template>

<style scoped>
.sample-tabs {
  display: flex;
  align-items: stretch;
  margin-bottom: var(--space-4);
  border-bottom: 1px solid #ddd;
  overflow: hidden;
  padding-left: 8px;
}

.sample-tab {
  flex: 0 1 200px;
  min-width: 60px;
  padding: 10px 14px;
  background: #eee;
  border: 1px solid #ccc;
  border-bottom: none;
  border-left: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  transition: background 0.2s;
  position: relative;
}

.sample-tab:first-child {
  border-left: 1px solid #ccc;
}

.sample-tab:hover {
  background: #f5f5f5;
}

.sample-tab--active {
  background: white;
  margin-bottom: -1px;
  padding-bottom: 11px;
  font-weight: 600;
  z-index: 1;
}

/* Pseudo-element for the top accent line on active tab */
.sample-tab--active::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: #007bff;
}

.sample-tab__content {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.sample-tab__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
}

.sample-tab__input {
  width: 100%;
  font-size: 13px;
  font-weight: inherit;
  border: 1px solid #007bff;
  border-radius: 2px;
  padding: 0 2px;
  outline: none;
  background: white;
}

.sample-tab__edit-btn {
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  color: #007bff;
  opacity: 0;
  transition: opacity 0.2s;
  padding: 2px;
  line-height: 1;
}

.sample-tab:hover .sample-tab__edit-btn {
  opacity: 1;
}

.sample-tab__close {
  background: none;
  border: none;
  font-size: 14px;
  line-height: 1;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #888;
  flex-shrink: 0;
}

.sample-tab__close:hover {
  background: rgba(0,0,0,0.05);
  color: #333;
}

.add-sample-btn {
  flex: 0 0 40px;
  background: #eee;
  border: 1px solid #ccc;
  border-bottom: none;
  border-left: none;
  color: #555;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.add-sample-btn:hover {
  background: #f5f5f5;
  color: #000;
}
</style>
