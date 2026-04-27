<script setup lang="ts">
// ECM Builder — Interactive equivalent circuit modelling for EIS data.
// Refactored to use a tabbed interface (Builder | Validate).

import { ref, computed, watch, provide, onMounted } from 'vue'
import BaseCard        from '@/components/ui/BaseCard.vue'
import BaseTabs        from '@/components/ui/BaseTabs.vue'
import ParameterEditor from '@/components/circuit/ParameterEditor.vue'
import ECMBuilderTab   from './ECMBuilderTab.vue'
import ECMValidateTab  from './ECMValidateTab.vue'
import ECMExportTab    from './ECMExportTab.vue'
import type { EisDataPoint, LocalStore } from '@/types/eis'
import type { CircuitNode }  from '@/components/circuit/CircuitNode'
import { useCircuitTree } from '@/composables/useCircuitTree'
import { useLMFitting }   from '@/composables/useLMFitting'
import { useCircuitModel, type ModelData } from '@/composables/useCircuitModel'
import { buildTreeFromString } from '@/utils/circuitParser'

const props = defineProps<{
  id: string
  eisData: EisDataPoint[]
  localStore: LocalStore
  sidebarTargetId: string
  eisPlotsRef?: { downloadPlotImage: (type: 'nyquist' | 'bode') => void } | null
}>()

const emit = defineEmits<{
  (e: 'update:model', data: ModelData | null): void
}>()

const builderTabRef = ref<InstanceType<typeof ECMBuilderTab> | null>(null)
const isMounted = ref(false)
onMounted(() => {
  isMounted.value = true
})

// ── Tab Management ───────────────────────────────────────────────────────────
const activeTab = ref('builder')
const tabs = [
  { id: 'builder', label: 'Circuit Builder' },
  { id: 'validate', label: 'Validate Model' },
  { id: 'export', label: 'Export' }
] as const

// ── Circuit tree logic (Parent-owned) ────────────────────────────────────────
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
  void renderVersion.value
  return collectNodes(rootNode.value)
})

// ── Model calculation logic (Parent-owned) ───────────────────────────────────
const showModel = ref(false)
const frequencies = computed(() => props.eisData.map(d => d['freq/Hz']))
const { modelData } = useCircuitModel(rootNode, frequencies, renderVersion)

watch([modelData, showModel], ([newModel, shouldShow]) => {
  emit('update:model', shouldShow ? newModel : null)
}, { immediate: true })

// ── Parameter changes ────────────────────────────────────────────────────────

function onParamChange(node: CircuitNode, param: 'value' | 'value2', value: number) {
  node[param] = value
  renderVersion.value++
}

function onRename(node: CircuitNode, newId: string) {
  node.id = newId
  renderVersion.value++
}

function onToggleLock(node: CircuitNode, paramIndex: 1 | 2) {
  if (paramIndex === 1) node.locked = !node.locked
  else node.locked2 = !node.locked2
  renderVersion.value++
}

function onUpdateLimit(node: CircuitNode, limit: 'min' | 'max' | 'min2' | 'max2', value: number | null) {
  node[limit] = value
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

function onSelectCircuit(circuitStr: string) {
  rootNode.value = buildTreeFromString(circuitStr)
  aiAppliedCircuit.value = null // Clear AI banner if manually selecting a common circuit
  resetCounters()
  renderVersion.value++
}

watch(
  () => props.localStore.aiSuggestedCircuit,
  (circuitStr) => {
    if (!circuitStr) return
    rootNode.value     = buildTreeFromString(circuitStr)
    aiAppliedCircuit.value = circuitStr
    resetCounters()
    renderVersion.value++
    
    // Reset the suggested circuit in the store so it can be re-applied
    // even if the user clicks the same one again after manual changes.
    props.localStore.setAiSuggestedCircuit(null)
  },
  { immediate: true },
)
</script>

<template>
  <BaseCard title="Equivalent Circuit Modeling" @dragstart.capture="isDragging = true" @dragend.capture="isDragging = false">
    <BaseTabs v-model="activeTab" :tabs="tabs">
      <div class="ecm-tab-content">
        <ECMBuilderTab
          ref="builderTabRef"
          v-show="activeTab === 'builder'"
          :root-node="rootNode"
          :render-version="renderVersion"
          :ai-applied-circuit="aiAppliedCircuit"
          @select-circuit="onSelectCircuit"
        />
        <ECMValidateTab
          v-show="activeTab === 'validate'"
          :root-node="rootNode"
          :eis-data="eisData"
          :model-data="modelData"
        />
        <ECMExportTab
          v-show="activeTab === 'export'"
          :id="props.id"
          :root-node="rootNode"
          :editable-nodes="editableNodes"
          :model-data="modelData"
          :eis-plots-ref="props.eisPlotsRef"
          :builder-tab-ref="builderTabRef"
        />
      </div>
    </BaseTabs>

    <!-- Teleport the parameters and fit buttons to the sidebar (Always mounted) -->
    <Teleport :to="'#' + sidebarTargetId" v-if="isMounted">
      <BaseCard title="Circuit Parameters">
        <div class="section-label" style="margin-top: 0;">
          Parameters
        </div>
        <ParameterEditor
          :nodes="editableNodes"
          @change="onParamChange"
          @rename="onRename"
          @toggle-lock="onToggleLock"
          @update-limit="onUpdateLimit"
        />

        <!-- Action buttons -->
        <div class="sidebar-actions">
          <div class="action-row-secondary">
            <button class="btn btn--outline" :disabled="eisData.length === 0"
              @click="showModel = true">
              {{ showModel ? 'Update Plot' : 'Plot Circuit' }}
            </button>
            <button class="btn btn--outline" :disabled="eisData.length === 0"
              @click="estimateInitialValues">
              Estimate Parameters
            </button>
          </div>
          <button class="btn btn--primary" :disabled="isFitting || eisData.length === 0"
            @click="fitModel">
            {{ isFitting ? 'Fitting…' : 'Fit Parameters (Auto)' }}
          </button>
          <span class="hint">Auto fits parameters using Levenberg Marquards algorithm</span>
        </div>
      </BaseCard>
    </Teleport>
  </BaseCard>
</template>

<style scoped>
.ecm-tab-content {
  padding-top: 10px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  margin: 14px 0 6px;
}

.sidebar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 24px; /* Increased from 12px */
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
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

.hint {
  font-weight: 400;
  font-size: 11px;
  color: #aaa;
  margin-left: 6px;
}
</style>
