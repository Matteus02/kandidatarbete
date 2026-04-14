import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  Circuit,
  EisDataPoint,
  FitResult,
} from '@/types/eis'

// Central store for EIS app state.
// All actions are stubs — fill them in as features get built.
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

  // --- UI state ---
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // --- Actions (stubs) ---
  function loadCsv(text: string, name: string): void {
    rawCsvText.value = text
    fileName.value = name
    // TODO: parse CSV (e.g. with papaparse) and populate dataPoints
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
  }
})
