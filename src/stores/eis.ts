import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  Circuit,
  EisDataPoint,
  FitResult,
} from '@/types/eis'
import type { PredictionItem } from '@/ai/workerProtocol'

import { parseEisCsv } from '@/utils/csvParser'

// Central store for EIS app state.
export const useEisStore = defineStore('eis', () => {
  // --- Raw input ---
  const rawCsvText = ref<string | null>(null)
  const fileName = ref<string | null>(null)

  // --- Parsed data ---
  const dataPoints = ref<EisDataPoint[]>([])

  const frequencies = computed(() => dataPoints.value.map((p) => p['freq/Hz']))
  const zReal = computed(() => dataPoints.value.map((p) => p['Re(Z)/Ohm']))
  const zImag = computed(() => dataPoints.value.map((p) => p['-Im(Z)/Ohm']))

  // --- Circuit & fit ---
  const selectedCircuit = ref<Circuit | null>(null)
  const fitParams = ref<FitResult | null>(null)
  const frequencyRange = ref<{ min: number; max: number } | null>(null)

  // --- AI state ---
  const aiSuggestedCircuit = ref<string | null>(null)
  const aiSuggestions = ref<PredictionItem[]>([])

  // --- UI state ---
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // --- Actions ---
  function loadCsv(text: string, name: string): void {
    rawCsvText.value = text
    fileName.value = name
    try {
      dataPoints.value = parseEisCsv(text)
    } catch (err) {
      console.error('Error parsing CSV in store:', err)
      dataPoints.value = []
    }
  }

  function clearData(): void {
    rawCsvText.value = null
    fileName.value = null
    dataPoints.value = []
    selectedCircuit.value = null
    fitParams.value = null
    frequencyRange.value = null
    error.value = null
  }

  function setSelectedCircuit(c: Circuit | null): void {
    selectedCircuit.value = c
    // TODO: clear or recompute fit when circuit changes
  }

  function setFitResult(r: FitResult | null): void {
    fitParams.value = r
  }

  function setFrequencyRange(range: { min: number; max: number } | null): void {
    frequencyRange.value = range
  }

  function setAiSuggestedCircuit(circuit: string | null): void {
    aiSuggestedCircuit.value = circuit
  }

  function setAiSuggestions(suggestions: PredictionItem[]): void {
    aiSuggestions.value = suggestions
  }

  return {
    // state
    rawCsvText,
    fileName,
    dataPoints,
    selectedCircuit,
    fitParams,
    frequencyRange,
    isLoading,
    error,
    aiSuggestedCircuit,
    aiSuggestions,
    // computed
    frequencies,
    zReal,
    zImag,
    // actions
    loadCsv,
    clearData,
    setSelectedCircuit,
    setFitResult,
    setFrequencyRange,
    setAiSuggestedCircuit,
    setAiSuggestions,
  }
})
