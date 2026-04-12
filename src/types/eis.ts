// Domain types for EIS analysis.
// These are intentionally minimal — extend as features are built.

export interface EisDataPoint {
  'freq/Hz': number;
  'Re(Z)/Ohm': number;
  '-Im(Z)/Ohm': number;
  '|Z|/Ohm': number;
  'Phase(Z)/deg': number;
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
