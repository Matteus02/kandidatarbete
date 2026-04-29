<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import DataPanel from '@/components/panels/DataPanel.vue'
import DataInfoPanel from '@/components/panels/DataInfoPanel.vue'
import EisPlots from '@/components/plots/EisPlots.vue'
import AIPanel from '@/components/panels/AIPanel.vue'
import ECMmodule from '@/components/modules/ECMmodule.vue'
import type { EisDataPoint, Circuit, FitResult, KKResult } from '@/types/eis'
import type { PredictionItem } from '@/ai/workerProtocol'
import type { ModelData } from '@/composables/useCircuitModel'
import { parseEisCsv } from '@/utils/csvParser'

// --- Local state for this sample ---
const state = reactive({
  rawCsvText: null as string | null,
  fileName: null as string | null,
  dataPoints: [] as EisDataPoint[],
  selectedCircuit: null as Circuit | null,
  fitParams: null as FitResult | null,
  aiSuggestedCircuit: null as string | null,
  aiSuggestions: [] as PredictionItem[],
  kkResult: null as KKResult | null,
  isLoading: false,
  error: null as string | null,
  minFreq: null as number | null,
  maxFreq: null as number | null,
})

const modelTrace = ref<ModelData | null>(null)

// --- Computed ---
const frequencies = computed(() => state.dataPoints.map((p) => p['freq/Hz']))
const zReal = computed(() => state.dataPoints.map((p) => p['Re(Z)/Ohm']))
const zImag = computed(() => state.dataPoints.map((p) => p['-Im(Z)/Ohm']))

const filteredDataPoints = computed(() => {
  if (state.minFreq === null && state.maxFreq === null) return state.dataPoints
  return state.dataPoints.filter((p) => {
    const f = p['freq/Hz']
    const min = state.minFreq ?? -Infinity
    const max = state.maxFreq ?? Infinity
    return f >= min && f <= max
  })
})

const isFiltered = computed(() => state.minFreq !== null || state.maxFreq !== null)

// --- Actions ---
function loadCsv(text: string, name: string): void {
  state.rawCsvText = text
  state.fileName = name
  state.minFreq = null
  state.maxFreq = null
  try {
    state.dataPoints = parseEisCsv(text)
    state.kkResult = null // Reset validation on new file
  } catch (err) {
    console.error('Error parsing CSV:', err)
    state.dataPoints = []
  }
}

function setAiSuggestedCircuit(circuit: string | null): void {
  state.aiSuggestedCircuit = circuit
}

function setAiSuggestions(suggestions: PredictionItem[]): void {
  state.aiSuggestions = suggestions
}

function setKkResult(result: KKResult | null): void {
  state.kkResult = result
}

function setFreqRange(min: number | null, max: number | null): void {
  state.minFreq = min
  state.maxFreq = max
}

// Mock of the store interface for compatibility with existing components
const localStore = {
  get rawCsvText() { return state.rawCsvText },
  get fileName() { return state.fileName },
  get dataPoints() { return state.dataPoints },
  get frequencies() { return frequencies.value },
  get zReal() { return zReal.value },
  get zImag() { return zImag.value },
  get aiSuggestedCircuit() { return state.aiSuggestedCircuit },
  get aiSuggestions() { return state.aiSuggestions },
  get isLoading() { return state.isLoading },
  get error() { return state.error },
  get kkResult() { return state.kkResult },
  get minFreq() { return state.minFreq },
  get maxFreq() { return state.maxFreq },
  setAiSuggestedCircuit,
  setAiSuggestions,
  loadCsv,
  setKkResult,
  setFreqRange,
}

const props = defineProps<{
  id: string
}>()

const sidebarTargetId = computed(() => `sidebar-parameters-target-${props.id}`)

const emit = defineEmits<{
  (e: 'update-name', name: string): void
}>()

const handleAnalysisComplete = (data: EisDataPoint[], name: string) => {
  state.dataPoints = data
  state.fileName = name
  state.minFreq = null
  state.maxFreq = null
  emit('update-name', name)
}

const handleUpdateFreqRange = (min: number | null, max: number | null) => {
  state.minFreq = min
  state.maxFreq = max
}

const handleApplyCircuit = (circuitString: string) => {
  setAiSuggestedCircuit(circuitString)
}

const handleUpdateModel = (data: ModelData | null) => {
  modelTrace.value = data
}

const eisPlotsRef = ref<{ downloadPlotImage: (type: 'nyquist' | 'bode') => void } | null>(null)
</script>

<template>
  <div class="sample-workspace">
    <div class="workspace-layout">
      <!-- Left Sidebar: Data & Info -->
      <aside class="workspace-sidebar workspace-sidebar--left">
        <DataPanel
          :id="props.id"
          :initial-file-name="state.fileName || ''"
          :initial-data="state.dataPoints"
          :min-freq="state.minFreq"
          :max-freq="state.maxFreq"
          @analysis-complete="handleAnalysisComplete"
          @update:freq-range="handleUpdateFreqRange"
        />
        <DataInfoPanel :data-points="state.dataPoints" :local-store="localStore" :is-filtered="isFiltered" />
      </aside>

      <!-- Main Content Column -->
      <main class="workspace-main">
        <EisPlots 
          ref="eisPlotsRef"
          :measurements="state.dataPoints" 
          :model-trace="modelTrace"
          :min-freq="state.minFreq"
          :max-freq="state.maxFreq"
        />

        <ECMmodule 
          v-if="state.dataPoints.length > 0"
          :id="props.id"
          :eis-data="filteredDataPoints" 
          :local-store="localStore"
          :sidebar-target-id="sidebarTargetId"
          :eis-plots-ref="eisPlotsRef"
          @update:model="handleUpdateModel"
        />
      </main>

      <!-- Right Sidebar: AI & Controls -->
      <aside class="workspace-sidebar workspace-sidebar--right">
        <AIPanel 
          :eis-data="filteredDataPoints" 
          :local-store="localStore"
          @apply-circuit="handleApplyCircuit" 
        />
        <div :id="sidebarTargetId"></div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.sample-workspace {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.workspace-layout {
  display: grid;
  grid-template-columns: 280px 1fr 400px;
  gap: 20px;
  align-items: start;
}

.workspace-main {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.workspace-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
  position: sticky;
  top: 20px;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  padding-right: 4px;
}

/* Custom scrollbar for sidebars */
.workspace-sidebar::-webkit-scrollbar {
  width: 4px;
}
.workspace-sidebar::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 4px;
}

@media (max-width: 1400px) {
  .workspace-layout {
    grid-template-columns: 250px 1fr 300px;
  }
}

@media (max-width: 1100px) {
  .workspace-layout {
    grid-template-columns: 250px 1fr;
  }
  .workspace-sidebar--right {
    display: none; /* Hide AI on medium screens or move it */
  }
}

@media (max-width: 800px) {
  .workspace-layout {
    grid-template-columns: 1fr;
  }
  .workspace-sidebar {
    position: static;
    max-height: none;
  }
}
</style>
