import type { PredictionItem } from '@/types/workerProtocol'

export interface EisDataPoint {
  'freq/Hz': number;
  'Re(Z)/Ohm': number;
  '-Im(Z)/Ohm': number;
  '|Z|/Ohm': number;
  'Phase(Z)/deg': number;
}

export interface KKResult {
  isConsistent: boolean
  rmse: number
  message: string
  testedAt: string
}

export interface LocalStore {
  readonly aiSuggestedCircuit: string | null
  readonly aiSuggestions: PredictionItem[]
  readonly kkResult: KKResult | null
  readonly minFreq: number | null
  readonly maxFreq: number | null
  setAiSuggestedCircuit: (circuit: string | null) => void
  setAiSuggestions: (suggestions: PredictionItem[]) => void
  setKkResult: (result: KKResult | null) => void
}
