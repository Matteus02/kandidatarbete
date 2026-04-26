<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import DataPanel from '@/components/panels/DataPanel.vue'
import DataInfoPanel from '@/components/panels/DataInfoPanel.vue'
import EisPlots from '@/components/plots/EisPlots.vue'
import AIPanel from '@/components/panels/AIPanel.vue'
import ECMmodule from '@/components/modules/ECMmodule.vue'
import type { EisDataPoint, Circuit, FitResult } from '@/types/eis'
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
  isLoading: false,
  error: null as string | null,
})

const modelTrace = ref<ModelData | null>(null)

// --- Computed ---
const frequencies = computed(() => state.dataPoints.map((p) => p['freq/Hz']))
const zReal = computed(() => state.dataPoints.map((p) => p['Re(Z)/Ohm']))
const zImag = computed(() => state.dataPoints.map((p) => p['-Im(Z)/Ohm']))

// --- Actions ---
function loadCsv(text: string, name: string): void {
  state.rawCsvText = text
  state.fileName = name
  try {
    state.dataPoints = parseEisCsv(text)
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
  setAiSuggestedCircuit,
  setAiSuggestions,
  loadCsv,
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
  emit('update-name', name)
}

const handleApplyCircuit = (circuitString: string) => {
  setAiSuggestedCircuit(circuitString)
}

const handleUpdateModel = (data: ModelData | null) => {
  modelTrace.value = data
}
</script>

<template>
  <div class="sample-workspace">
    <div class="workspace-layout">
      <!-- Left Sidebar: Data & Info -->
      <aside class="workspace-sidebar workspace-sidebar--left">
        <DataPanel
          :initial-file-name="state.fileName || ''"
          :initial-data="state.dataPoints"
          @analysis-complete="handleAnalysisComplete"
        />
        <DataInfoPanel :data-points="state.dataPoints" />
      </aside>

      <!-- Main Content Column -->
      <main class="workspace-main">
        <EisPlots 
          :measurements="state.dataPoints" 
          :model-trace="modelTrace"
        />

        <ECMmodule 
          v-if="state.dataPoints.length > 0"
          :eis-data="state.dataPoints" 
          :local-store="localStore"
          :sidebar-target-id="sidebarTargetId"
          @update:model="handleUpdateModel"
        />
      </main>

      <!-- Right Sidebar: AI & Controls -->
      <aside class="workspace-sidebar workspace-sidebar--right">
        <AIPanel 
          :eis-data="state.dataPoints" 
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
  grid-template-columns: 280px 1fr 320px;
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
