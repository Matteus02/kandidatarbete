import type { ElementType } from '@/utils/CircuitNode'

// Sköter kommunikationen mellan main thread och worker för LM-fittning (datatyper).

//JSON represenation av CircuitNode, där referenser till andra noder är via ID:n. pga worker kan inte komma åt referenser direkt.
export interface SerializedNode {
  id: string
  type: ElementType
  value: number
  value2: number
  nextId: string | null
  upperBranchId: string | null
  lowerBranchId: string | null
  locked: boolean
  locked2: boolean
}

// Meddelande som main skickar till worker, innehåller serialiserade noder och mätdata.
export interface FittingRequest {
  type: 'fit'
  nodes: SerializedNode[]
  rootId: string
  frequencies: number[]
  zReal: number[]
  zImag: number[]
  paramRefs: Array<{ nodeId: string; param: 'value' | 'value2' }>
}

//Svar från worker till main (antingen resultat av fittning eller ett felmeddelande)
export type FittingResponse =
  | { type: 'result'; fittedValues: number[]; paramErrors: number[]; chiSquared: number; iterations: number }
  | { type: 'error'; message: string }
