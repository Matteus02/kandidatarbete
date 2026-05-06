<script setup lang="ts">
// Renders a vertical list of labeled number inputs for each circuit element's parameters.
// When the user changes a value this component emits a 'change' event instead of
// modifying the node directly, keeping the data-flow unidirectional.

import { ref } from 'vue'
import type { CircuitNode, ElementType } from '@/utils/CircuitNode'

defineProps<{
  nodes: CircuitNode[]
  paramErrors?: Record<string, number>
}>()

const emit = defineEmits<{
  change: [node: CircuitNode, param: 'value' | 'value2', value: number],
  rename: [node: CircuitNode, newId: string],
  toggleLock: [node: CircuitNode, paramIndex: 1 | 2],
}>()

// Units shown next to each element label in the parameter list
const UNITS: Partial<Record<ElementType, string>> = {
  R:   'Ω',
  C:   'F',
  CPE: 'Q',
  W:   'Ω·s⁻⁰·⁵',
  Wo:  'Rw (Ω)',
  Ws:  'Rw (Ω)',
  L:   'H',
}

// Units for the second parameter — CPE (n), Wo and Ws (τ)
const UNITS2: Partial<Record<ElementType, string>> = {
  CPE: 'n',
  Wo: 'τ (s)',
  Ws: 'τ (s)',
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

function fmt(v: number | undefined | null): string {
  if (v == null || isNaN(v)) return ''
  const abs = Math.abs(v)
  if (abs !== 0 && (abs < 0.01 || abs >= 1e6)) return v.toExponential(3)
  return parseFloat(v.toPrecision(4)).toString()
}

function fmtError(value: number | undefined, error: number | undefined): string {
  if (value == null || error == null || isNaN(value) || isNaN(error) || error <= 0 || value === 0) return ''
  const pct = (error / Math.abs(value)) * 100
  return '± ' + pct.toFixed(2) + ' %'
}
</script>

<template>
  <div class="param-editor-scroll">
    <div class="param-list-header">
      <span class="col-header col-header--lock"></span>
      <span class="col-header col-header--param">Parameter</span>
      <span class="col-header col-header--value">Value</span>
      <span class="col-header col-header--error">Error %</span>
    </div>
    <div class="param-list">
      <template v-for="node in nodes" :key="node.id">
        <!-- Row for the first parameter -->
        <div class="param-group">
          <div class="param-main-row">
            <div class="lock-cell">
              <button
                :class="['lock-btn', { 'lock-btn--active': node.locked }]"
                :title="node.locked ? 'Unlock parameter' : 'Lock parameter'"
                @click="emit('toggleLock', node, 1)"
              >
                {{ node.locked ? '🔒' : '🔓' }}
              </button>
            </div>

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

            <div class="input-cell val-cell">
              <input
                class="param-input"
                type="text"
                :value="fmt(node.value)"
                :disabled="node.locked"
                @change="(e) => onInput(node, 'value', (e.target as HTMLInputElement).value)"
              />
            </div>

            <span class="param-error">{{ fmtError(node.value, paramErrors?.[`${node.id}:value`]) }}</span>

          </div>

          <!-- Optional second row for two-parameter elements (CPE, Wo, Ws) -->
          <div v-if="UNITS2[node.type as ElementType]" class="param-secondary-row">
            <div class="lock-cell">
              <button
                :class="['lock-btn', { 'lock-btn--active': node.locked2 }]"
                :title="node.locked2 ? 'Unlock parameter' : 'Lock parameter'"
                @click="emit('toggleLock', node, 2)"
              >
                {{ node.locked2 ? '🔒' : '🔓' }}
              </button>
            </div>

            <div class="param-info">
              <div class="param-id-wrap">
                <span class="param-id-hidden">{{ node.id }}</span>
              </div>
              <span class="param-unit-label">{{ UNITS2[node.type as ElementType] }}</span>
            </div>

            <div class="input-cell val-cell">
              <input
                class="param-input"
                type="text"
                :value="fmt(node.value2)"
                :disabled="node.locked2"
                @change="(e) => onInput(node, 'value2', (e.target as HTMLInputElement).value)"
              />
            </div>

            <span class="param-error">{{ fmtError(node.value2, paramErrors?.[`${node.id}:value2`]) }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
const vFocus = {
  mounted: (el: HTMLElement) => el.focus()
}
</script>

<style scoped>
.param-editor-scroll {
  max-height: calc(100vh - 500px);
  overflow-y: auto;
  /* Use negative margins to pull the rows to the very edge of the BaseCard */
  margin: 0 -24px;
  padding: 0;
}

.param-editor-scroll::-webkit-scrollbar {
  width: 4px;
}
.param-editor-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

.param-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.col-header {
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  white-space: nowrap;
  flex-shrink: 0;
}

.col-header--lock  { width: 24px; }
.col-header--param { width: 95px; }
.col-header--value { width: 75px; text-align: left; }
.col-header--error { min-width: 80px; text-align: left; }

.param-list {
  display: flex;
  flex-direction: column;
}

.param-group {
  display: flex;
  flex-direction: column;
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
}

.param-group:first-child {
  border-top: 1px solid #e2e8f0;
}

.param-main-row, .param-secondary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
}

.param-secondary-row {
  background: #f8fafc;
  border-top: 1px dashed #e2e8f0;
}

.lock-cell {
  width: 24px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}

.lock-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 0;
  opacity: 0.3;
  transition: all 0.2s;
  filter: grayscale(1);
}

.lock-btn:hover {
  opacity: 1;
  filter: none;
  transform: scale(1.1);
}

.lock-btn--active {
  opacity: 1;
  filter: none;
}

.param-info {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 4px;
  width: 95px;
  flex-shrink: 0;
}

.param-id-wrap {
  flex: 1;
  display: flex;
  justify-content: flex-start;
  min-width: 0;
}

.param-id {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70px;
}

.param-id:hover {
  text-decoration: underline;
  color: #007bff;
}

.param-id-input {
  width: 65px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid #3b82f6;
  border-radius: 3px;
  padding: 0 2px;
  outline: none;
  text-align: left;
}

.param-id-hidden {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: transparent;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70px;
  user-select: none;
}

.param-unit-label {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  text-align: right;
  min-width: 20px;
}

.input-cell {
  flex-shrink: 0;
}

.val-cell { width: 75px; } 

.param-input {
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  font-family: monospace;
  width: 100%;
  box-sizing: border-box;
  text-align: right;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.param-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.param-input:disabled {
  background: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
  border-color: #e2e8f0;
}

.param-error {
  font-size: 10px;
  font-family: monospace;
  color: #94a3b8;
  white-space: nowrap;
  min-width: 80px;
}
</style>
