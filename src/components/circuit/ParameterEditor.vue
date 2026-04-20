<script setup lang="ts">
// Renders a grid of labeled number inputs for each circuit element's parameters.
//
// Most elements have one parameter (e.g. R in Ω, C in F).
// Two-parameter elements (Wo, Ws) get a second input for τ (the diffusion time constant).
//
// When the user changes a value this component emits a 'change' event instead of
// modifying the node directly, keeping the data-flow unidirectional.

import type { CircuitNode, ElementType } from '@/components/circuit/CircuitNode'

defineProps<{ nodes: CircuitNode[] }>()

const emit = defineEmits<{
  change: [node: CircuitNode, param: 'value' | 'value2', value: number]
}>()

// Units shown next to each element label in the parameter grid
const UNITS: Partial<Record<ElementType, string>> = {
  R:   'Ω',
  C:   'F',
  CPE: 'Q  (n = 0.85)',
  W:   'Ω·s⁻⁰·⁵',
  Wo:  'Rw  (Ω)',
  Ws:  'Rw  (Ω)',
  L:   'H',
}

// Units for the second parameter — only Wo and Ws have one
const UNITS2: Partial<Record<ElementType, string>> = {
  Wo: 'τ  (s)',
  Ws: 'τ  (s)',
}

function onInput(node: CircuitNode, param: 'value' | 'value2', raw: string) {
  const parsed = parseFloat(raw)
  if (!isNaN(parsed)) emit('change', node, param, parsed)
}
</script>

<template>
  <div class="param-grid">
    <template v-for="node in nodes" :key="node.id">

      <!-- Single-parameter elements (R, C, CPE, W, L) -->
      <div v-if="!UNITS2[node.type as ElementType]" class="param-item">
        <label class="param-label">
          {{ node.id }}
          <span class="param-unit">{{ UNITS[node.type as ElementType] ?? '' }}</span>
        </label>
        <input
          class="param-input"
          type="number"
          :value="node.value"
          step="any"
          @change="(e) => onInput(node, 'value', (e.target as HTMLInputElement).value)"
        />
      </div>

      <!-- Two-parameter elements (Wo, Ws): grouped card showing ID once -->
      <div v-else class="param-group">
        <div class="param-group-title">{{ node.id }}</div>
        <div class="param-item">
          <label class="param-label">
            <span class="param-unit">{{ UNITS[node.type as ElementType] }}</span>
          </label>
          <input
            class="param-input"
            type="number"
            :value="node.value"
            step="any"
            @change="(e) => onInput(node, 'value', (e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="param-item">
          <label class="param-label">
            <span class="param-unit">{{ UNITS2[node.type as ElementType] }}</span>
          </label>
          <input
            class="param-input"
            type="number"
            :value="node.value2"
            step="any"
            @change="(e) => onInput(node, 'value2', (e.target as HTMLInputElement).value)"
          />
        </div>
      </div>

    </template>
  </div>
</template>

<style scoped>
.param-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 110px;
}

.param-label {
  font-size: 11px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.param-unit {
  font-weight: 400;
  color: #888;
  margin-left: 3px;
}

.param-input {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 3px 5px;
  font-size: 12px;
  width: 100%;
  box-sizing: border-box;
}

.param-input:focus {
  outline: none;
  border-color: #007bff;
}

.param-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 110px;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 6px;
  background: #f8f8f8;
  box-sizing: border-box;
}

.param-group-title {
  font-size: 11px;
  font-weight: 700;
  color: #333;
}

.param-group .param-item {
  width: 100%;
}
</style>
