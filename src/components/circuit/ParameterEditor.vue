<script setup lang="ts">
// Renders a vertical list of labeled number inputs for each circuit element's parameters.
//
// This row-based layout provides horizontal space for future features, such as 
// min/max boundary inputs and lock toggles for parameter fitting.
//
// When the user changes a value this component emits a 'change' event instead of
// modifying the node directly, keeping the data-flow unidirectional.

import { ref } from 'vue'
import type { CircuitNode, ElementType } from '@/components/circuit/CircuitNode'

defineProps<{ nodes: CircuitNode[] }>()

const emit = defineEmits<{
  change: [node: CircuitNode, param: 'value' | 'value2', value: number],
  rename: [node: CircuitNode, newId: string]
}>()

// Units shown next to each element label in the parameter list
const UNITS: Partial<Record<ElementType, string>> = {
  R:   'Ω',
  C:   'F',
  CPE: 'Q',
  W:   'Ω·s⁻⁰·⁵',
  Wo:  'Rw  (Ω)',
  Ws:  'Rw  (Ω)',
  L:   'H',
}

// Units for the second parameter — CPE (n), Wo and Ws (τ)
const UNITS2: Partial<Record<ElementType, string>> = {
  CPE: 'n',
  Wo: 'τ  (s)',
  Ws: 'τ  (s)',
}

const editingId = ref<string | null>(null)
const tempId = ref('')

function startRename(node: CircuitNode) {
  editingId.value = node.id
  tempId.value = node.id
}

function finishRename(node: CircuitNode) {
  if (editingId.value === node.id) {
    const trimmed = tempId.value.trim()
    if (trimmed && trimmed !== node.id) {
      emit('rename', node, trimmed)
    }
    editingId.value = null
  }
}

function onInput(node: CircuitNode, param: 'value' | 'value2', raw: string) {
  const parsed = parseFloat(raw)
  if (!isNaN(parsed)) emit('change', node, param, parsed)
}

function fmt(v: number | undefined): string {
  if (v == null) return ''
  const abs = Math.abs(v)
  if (abs !== 0 && (abs < 0.01 || abs >= 1e6)) return v.toExponential(3)
  return parseFloat(v.toPrecision(4)).toString()
}
</script>

<template>
  <div class="param-list">
    <template v-for="node in nodes" :key="node.id">

      <!-- Row for the first parameter -->
      <div class="param-row">
        <div class="param-info">
          <div class="param-id-wrap" :title="node.id">
            <input
              v-if="editingId === node.id"
              v-model="tempId"
              class="param-id-input"
              @blur="finishRename(node)"
              @keyup.enter="finishRename(node)"
              v-focus
            />
            <span v-else class="param-id" @click="startRename(node)">{{ node.id }}</span>
          </div>
          <span class="param-unit-label">{{ UNITS[node.type as ElementType] ?? '' }}</span>
        </div>
        <div class="param-input-container">
          <input
            class="param-input"
            type="text"
            :value="fmt(node.value)"
            @change="(e) => onInput(node, 'value', (e.target as HTMLInputElement).value)"
          />
        </div>
        <!-- Future: space for min/max/lock controls -->
        <div class="param-controls-placeholder"></div>
      </div>

      <!-- Optional second row for two-parameter elements (CPE, Wo, Ws) -->
      <div v-if="UNITS2[node.type as ElementType]" class="param-row param-row--secondary">
        <div class="param-info">
          <span class="param-id-hidden">{{ node.id }}</span>
          <span class="param-unit-label">{{ UNITS2[node.type as ElementType] }}</span>
        </div>
        <div class="param-input-container">
          <input
            class="param-input"
            type="text"
            :value="fmt(node.value2)"
            @change="(e) => onInput(node, 'value2', (e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="param-controls-placeholder"></div>
      </div>

    </template>
  </div>
</template>

<script lang="ts">
// Custom directive to focus the input when it appears
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}
</script>

<style scoped>
.param-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 14px;
}

.param-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  background: #fdfdfd;
  border: 1px solid #eee;
  border-radius: 4px;
}

.param-row--secondary {
  border-top-style: dashed;
  margin-top: -4px;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  background: #fafafa;
}

.param-info {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 90px;
  flex-shrink: 0;
}

.param-id-wrap {
  width: 45px;
  flex-shrink: 0;
  overflow: hidden;
}

.param-id {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #333;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px dashed transparent;
  transition: border-color 0.2s;
}

.param-id:hover {
  border-bottom-color: #aaa;
}

.param-id-input {
  width: 100%;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid #007bff;
  border-radius: 2px;
  padding: 0 2px;
  outline: none;
}

.param-id-hidden {
  font-size: 12px;
  color: transparent;
  width: 45px;
  user-select: none;
}

.param-unit-label {
  font-size: 11px;
  color: #777;
  white-space: nowrap;
}

.param-input-container {
  flex-grow: 1;
  min-width: 60px;
  max-width: 100px;
}

.param-input {
  border: 1px solid #ccc;
  border-radius: 3px;
  padding: 3px 6px;
  font-size: 12px;
  font-family: monospace;
  width: 100%;
  box-sizing: border-box;
}

.param-input:focus {
  outline: none;
  border-color: #007bff;
  background: #fff;
}

.param-controls-placeholder {
  width: 40px; /* Space for future icons */
  flex-shrink: 0;
}
</style>
