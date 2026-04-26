<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import BaseTabPanel from '@/components/ui/BaseTabPanel.vue'
import type { TabItem } from '@/components/ui/tabsContext'
import DataPanel from '@/components/panels/DataPanel.vue'
import PlotPanel from '@/components/panels/PlotPanel.vue'
import AIPanel from '@/components/panels/AIPanel.vue'
import FitPanel from '@/components/panels/FitPanel.vue'
import ExportPanel from '@/components/panels/ExportPanel.vue'
import ECMmodule from '@/components/modules/ECMmodule.vue'
import type { EisDataPoint, Circuit, FitResult } from '@/types/eis'
import type { PredictionItem } from '@/ai/workerProtocol'
import { parseEisCsv } from '@/utils/csvParser'

const tabs = [
  { id: 'data',   label: 'Data' },
  { id: 'plot',   label: 'Plot' },
  { id: 'ai',     label: 'AI' },
  { id: 'ecm',    label: 'ECM' },
  { id: 'fit',    label: 'Fit' },
  { id: 'export', label: 'Export' },
] as const satisfies readonly TabItem[]

type TabId = (typeof tabs)[number]['id']

const activeTab = ref<TabId>('data')

// --- Local state for this sample ---
const state = reactive({
  rawCsvText: null as string | null,
  fileName: null as string | null,
  dataPoints: [] as EisDataPoint[],
  selectedCircuit: null as Circuit | null,
  fitParams: null as FitResult | null,
  frequencyRange: null as { min: number; max: number } | null,
  aiSuggestedCircuit: null as string | null,
  aiSuggestions: [] as PredictionItem[],
  isLoading: false,
  error: null as string | null,
})

// --- Computed ---
const frequencies = computed(() => state.dataPoints.map((p) => p['freq/Hz']))
const zReal = computed(() => state.dataPoints.map((p) => p['Re(Z)/Ohm']))
const zImag = computed(() => state.dataPoints.map((p) => p['-Im(Z)/Ohm']))

// --- Actions (passed to children via local object or props) ---
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
// We will pass this to components that currently use `useEisStore()`
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

const emit = defineEmits<{
  (e: 'update-name', name: string): void
}>()

const handleAnalysisComplete = (data: EisDataPoint[], name: string) => {
  state.dataPoints = data
  state.fileName = name
  activeTab.value = 'plot'
  emit('update-name', name)
}

const handleModelCircuit = () => {
  activeTab.value = 'ai'
}

const handleApplyCircuit = (circuitString: string) => {
  setAiSuggestedCircuit(circuitString)
  activeTab.value = 'ecm'
}
</script>

<template>
  <div class="sample-workspace">
    <BaseTabs :tabs="tabs" v-model="activeTab">
      <BaseTabPanel tab-id="data">
        <DataPanel
          :initial-file-name="state.fileName || ''"
          :initial-data="state.dataPoints"
          @analysis-complete="handleAnalysisComplete"
        />
      </BaseTabPanel>
      <BaseTabPanel tab-id="plot">
        <PlotPanel :eis-data="state.dataPoints" @model-circuit="handleModelCircuit" />
      </BaseTabPanel>
      <BaseTabPanel tab-id="ai">
        <AIPanel 
          :eis-data="state.dataPoints" 
          :local-store="localStore"
          @apply-circuit="handleApplyCircuit" 
        />
      </BaseTabPanel>
      <BaseTabPanel tab-id="ecm">
        <ECMmodule 
          :eis-data="state.dataPoints" 
          :local-store="localStore"
        />
      </BaseTabPanel>
      <BaseTabPanel tab-id="fit"><FitPanel /></BaseTabPanel>
      <BaseTabPanel tab-id="export"><ExportPanel /></BaseTabPanel>
    </BaseTabs>
  </div>
</template>

<style scoped>
.sample-workspace {
  display: flex;
  flex-direction: column;
}
</style>
