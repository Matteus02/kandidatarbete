<script setup lang="ts">
import { computed } from 'vue'
import { COMMON_CIRCUITS } from '@/utils/commonCircuits'

const props = defineProps<{
  currentCircuit: string
}>()

const emit = defineEmits<{
  (e: 'select', circuit: string): void
}>()

const selectedValue = computed(() => {
  const match = COMMON_CIRCUITS.find(c => c.circuit === props.currentCircuit)
  return match ? match.circuit : 'custom'
})

function onChange(event: Event) {
  const target = event.target as HTMLSelectElement
  if (target.value && target.value !== 'custom') {
    emit('select', target.value)
  }
}
</script>

<template>
  <div class="common-circuits">
    <label for="circuit-select" class="dropdown-label">Common Circuits:</label>
    <select id="circuit-select" class="circuit-dropdown" :value="selectedValue" @change="onChange">
      <option value="custom" disabled>
        {{ selectedValue === 'custom' ? 'Custom' : 'Select a template...' }}
      </option>
      <option v-for="c in COMMON_CIRCUITS" :key="c.circuit" :value="c.circuit">
        {{ c.name }} ({{ c.circuit }})
      </option>
    </select>
  </div>
</template>

<style scoped>
.common-circuits {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.dropdown-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.circuit-dropdown {
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  color: #333;
  outline: none;
  cursor: pointer;
  min-width: 250px;
}

.circuit-dropdown:focus {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}
</style>
