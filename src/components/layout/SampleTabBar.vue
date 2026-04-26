<script setup lang="ts">
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
}>()
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
      <span class="sample-tab__name">{{ sample.name }}</span>
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

.sample-tab__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  flex: 1;
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
