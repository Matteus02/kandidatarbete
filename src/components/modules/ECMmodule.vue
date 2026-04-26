<script setup lang="ts">
// ECM Builder — Interactive equivalent circuit modelling for EIS data.
//
// Responsibilities of this component (the "glue"):
//   1. Owns the Plotly plots (Nyquist + Bode) and redraws them when needed.
//   2. Wires up the three sub-systems via composables and sub-components.
//   3. Watches the Pinia store for AI-suggested circuits and loads them.
//
// Logic is delegated to:
//   useCircuitTree — circuit tree state, drag-drop, node mutations
//   useLMFitting   — heuristic initialisation and Levenberg-Marquardt fitting
//   CircuitPalette — drag-and-drop element palette UI
//   ParameterEditor — parameter input grid UI

import { ref, computed, watch, provide, onMounted } from 'vue'
import BaseCard        from '@/components/ui/BaseCard.vue'
import CircuitRenderer from '@/components/circuit/CircuitRenderer.vue'
import CircuitPalette  from '@/components/circuit/CircuitPalette.vue'
import ParameterEditor from '@/components/circuit/ParameterEditor.vue'
import type { EisDataPoint, LocalStore } from '@/types/eis'
import type { CircuitNode }  from '@/components/circuit/CircuitNode'
import { useCircuitTree } from '@/composables/useCircuitTree'
import { useLMFitting }   from '@/composables/useLMFitting'
import { useCircuitModel, type ModelData } from '@/composables/useCircuitModel'
import { buildTreeFromString } from '@/utils/circuitParser'

const props = defineProps<{ 
  eisData: EisDataPoint[]
  localStore: LocalStore
  sidebarTargetId: string
}>()

const emit = defineEmits<{
  (e: 'update:model', data: ModelData | null): void
}>()

const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

// ── Circuit tree ─────────────────────────────────────────────────────────────
const {
  rootNode, renderVersion, collectNodes, resetCounters,
  handleNodeDrop, insertIntoEmptyBranch, deleteNode,
} = useCircuitTree()

provide('handleNodeDrop', handleNodeDrop)
provide('insertIntoEmptyBranch', insertIntoEmptyBranch)
provide('deleteNode', deleteNode)

const isDragging = ref(false)
provide('isDragging', isDragging)

const editableNodes = computed(() => {
  // Access renderVersion to ensure re-computation when tree structure changes
  void renderVersion.value
  return collectNodes(rootNode.value)
})

// ── Model calculation ────────────────────────────────────────────────────────
const showModel = ref(false)
const frequencies = computed(() => props.eisData.map(d => d['freq/Hz']))
const { modelData } = useCircuitModel(rootNode, frequencies, renderVersion)

// Sync model data with parent for plotting
watch([modelData, showModel], ([newModel, shouldShow]) => {
  emit('update:model', shouldShow ? newModel : null)
}, { immediate: true })

// ── Parameter changes ────────────────────────────────────────────────────────

function onParamChange(node: CircuitNode, param: 'value' | 'value2', value: number) {
  node[param] = value
  // Increment renderVersion to trigger useCircuitModel re-calculation
  renderVersion.value++
}

function onRename(node: CircuitNode, newId: string) {
  node.id = newId
  renderVersion.value++
}

// ── Curve fitting ────────────────────────────────────────────────────────────

function onRedraw() {
  renderVersion.value++
}

const { isFitting, estimateInitialValues, fitModel } = useLMFitting(
  rootNode,
  () => props.eisData,
  collectNodes,
  onRedraw,
)

// ── AI suggestion integration ────────────────────────────────────────────────

const aiAppliedCircuit = ref<string | null>(null)

watch(
  () => props.localStore.aiSuggestedCircuit,
  (circuitStr) => {
    if (!circuitStr) return
    rootNode.value     = buildTreeFromString(circuitStr)
    aiAppliedCircuit.value = circuitStr
    resetCounters()
    renderVersion.value++
  },
  { immediate: true },
)
</script>

<template>
  <BaseCard title="ECM Builder" @dragstart.capture="isDragging = true" @dragend.capture="isDragging = false">

    <!-- Banner shown when a circuit was loaded from the AI tab -->
    <div v-if="aiAppliedCircuit" class="ai-banner">
      AI suggestion loaded: <code>{{ aiAppliedCircuit }}</code>
    </div>

    <!-- SVG circuit canvas (key forces full re-render on every tree change) -->
    <div class="section-label">Circuit</div>
    <div class="canvas-wrap">
      <svg class="circuit-svg" width="900" height="250" style="overflow: visible" :key="renderVersion">
        <CircuitRenderer :node="rootNode" :x="50" :y="125" />
      </svg>
    </div>

    <!-- Drag-and-drop element palette + usage instructions -->
    <CircuitPalette />

    <!-- Teleport the parameters and fit buttons to the sidebar -->
    <Teleport :to="'#' + sidebarTargetId" v-if="isMounted">
      <BaseCard title="Circuit Parameters">
        <div class="section-label" style="margin-top: 0;">
          Parameters
          <span class="hint">(edit manually, or use the buttons below)</span>
        </div>
        <ParameterEditor :nodes="editableNodes" @change="onParamChange" @rename="onRename" />

        <!-- Action buttons -->
        <div class="sidebar-actions">
          <div class="action-row-secondary">
            <button class="btn btn--outline" :disabled="props.eisData.length === 0"
              @click="showModel = true">
              {{ showModel ? 'Update Plot' : 'Plot Circuit' }}
            </button>
            <button class="btn btn--outline" :disabled="props.eisData.length === 0"
              @click="estimateInitialValues">
              Estimate
            </button>
          </div>
          <button class="btn btn--primary" :disabled="isFitting || props.eisData.length === 0"
            @click="fitModel">
            {{ isFitting ? 'Fitting…' : 'Fit Parameters (Auto)' }}
          </button>
        </div>
      </BaseCard>
    </Teleport>

  </BaseCard>
</template>


<style scoped>
.plot-row { display: flex; gap: 10px; justify-content: center; }
.plot     { flex: 1; min-width: 0; }

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  margin: 14px 0 6px;
}

.canvas-wrap {
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fafafa;
  overflow-x: auto;
  padding: 8px 0;
}

.circuit-svg { display: block; }

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.action-row-secondary {
  display: flex;
  gap: 8px;
}

.btn {
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--primary {
  background: #007bff;
  color: white;
  width: 100%;
}

.btn--primary:hover:not(:disabled) {
  background: #0056b3;
}

.btn--outline {
  background: white;
  border-color: #007bff;
  color: #007bff;
  flex: 1;
}

.btn--outline:hover:not(:disabled) {
  background: #f0f7ff;
}

.btn--secondary {
  background: #6c757d;
  color: white;
}

.hint {
  font-weight: 400;
  font-size: 11px;
  color: #aaa;
  margin-left: 6px;
}

.no-data-hint { margin-top: 6px; font-size: 13px; color: #888; }

.ai-banner {
  padding: 8px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  font-size: 13px;
  color: #1e40af;
  margin-bottom: 10px;
}
</style>
