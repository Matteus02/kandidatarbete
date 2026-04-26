// Domain types for EIS analysis.
// These are intentionally minimal — extend as features are built.

import type { PredictionItem } from '@/ai/workerProtocol'

export interface EisDataPoint {
  'freq/Hz': number;
  'Re(Z)/Ohm': number;
  '-Im(Z)/Ohm': number;
  '|Z|/Ohm': number;
  'Phase(Z)/deg': number;
}

export interface LocalStore {
  readonly rawCsvText: string | null
  readonly fileName: string | null
  readonly dataPoints: EisDataPoint[]
  readonly frequencies: number[]
  readonly zReal: number[]
  readonly zImag: number[]
  readonly aiSuggestedCircuit: string | null
  readonly aiSuggestions: PredictionItem[]
  readonly isLoading: boolean
  readonly error: string | null
  setAiSuggestedCircuit: (circuit: string | null) => void
  setAiSuggestions: (suggestions: PredictionItem[]) => void
  loadCsv: (text: string, name: string) => void
}

export type CircuitElementKind = 'R' | 'C' | 'L' | 'CPE' | 'W'

export interface CircuitElement {
  id: string
  kind: CircuitElementKind
  label?: string
  initialValue?: number
  locked?: boolean
}

export type CircuitNode =
  | { type: 'element'; element: CircuitElement }
  | { type: 'series'; children: CircuitNode[] }
  | { type: 'parallel'; children: CircuitNode[] }

export interface Circuit {
  id: string
  name: string
  root: CircuitNode
}

export interface FittedParameter {
  elementId: string
  name: string
  value: number
  error?: number
  locked: boolean
}

export interface FitResult {
  circuitId: string
  parameters: FittedParameter[]
  chiSquared?: number
  frequencyRange?: { min: number; max: number }
  createdAt: string // ISO timestamp
}

export type PlotKind = 'nyquist' | 'bode'
