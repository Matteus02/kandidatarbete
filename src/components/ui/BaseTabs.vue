<script setup lang="ts">
import { provide, toRef } from 'vue'
import { ActiveTabKey, type TabItem } from './tabsContext'

interface Props {
  tabs: readonly TabItem[]
  modelValue: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

provide(ActiveTabKey, toRef(props, 'modelValue'))

function select(id: string): void {
  if (id !== props.modelValue) {
    emit('update:modelValue', id)
  }
}
</script>

<template>
  <div class="tabs">
    <div class="tabs__header" role="tablist">
      <button
        v-for="tab in props.tabs"
        :key="tab.id"
        role="tab"
        :aria-selected="tab.id === props.modelValue"
        :class="['tabs__tab', { 'tabs__tab--active': tab.id === props.modelValue }]"
        @click="select(tab.id)"
      >
        {{ tab.label }}
      </button>
    </div>
    <div class="tabs__content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.tabs__header {
  display: flex;
  gap: var(--space-1);
  border-bottom: 1px solid var(--color-border);
}

.tabs__tab {
  padding: var(--space-2) var(--space-3);
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.tabs__tab:hover {
  color: var(--color-text);
}

.tabs__tab--active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tabs__content {
  display: flex;
  flex-direction: column;
}
</style>
