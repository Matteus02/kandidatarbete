import type { ElementType } from '@/components/circuit/CircuitNode'

// JSON-serializable snapshot of one CircuitNode.
// Pointer fields are stored as string IDs so the worker can reconstruct the tree.
export interface SerializedNode {
  id: string
  type: ElementType
  value: number
  value2: number
  nextId: string | null
  upperBranchId: string | null
  lowerBranchId: string | null
}

export interface FittingRequest {
  type: 'fit'
  nodes: SerializedNode[]
  rootId: string
  frequencies: number[]
  zReal: number[]
  zImag: number[]
  minValues: number[]
  maxValues: number[]
  paramRefs: Array<{ nodeId: string; param: 'value' | 'value2' }>
}

export type FittingResponse =
  | { type: 'result'; fittedValues: number[]; chiSquared: number; iterations: number }
  | { type: 'error'; message: string }
