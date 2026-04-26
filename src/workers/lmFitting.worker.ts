/// <reference lib="webworker" />

import { CircuitNode } from '@/components/circuit/CircuitNode'
import { zOfChain } from '@/utils/circuitImpedance'
import { fitCircuit } from '@/utils/lmFitting'
import type { FittingRequest, FittingResponse, SerializedNode } from '@/ai/fittingWorkerProtocol'

function deserializeNodes(nodes: SerializedNode[], rootId: string): CircuitNode {
  // Pass 1: create all node instances
  const map = new Map<string, CircuitNode>()
  for (const s of nodes) {
    const node = new CircuitNode(s.id, s.type, s.value, s.value2)
    node.locked = s.locked
    node.locked2 = s.locked2
    node.min = s.min
    node.max = s.max
    node.min2 = s.min2
    node.max2 = s.max2
    map.set(s.id, node)
  }

  // Pass 2: wire up pointer links
  for (const s of nodes) {
    const node = map.get(s.id)!
    node.next        = s.nextId        ? (map.get(s.nextId)        ?? null) : null
    node.upperBranch = s.upperBranchId ? (map.get(s.upperBranchId) ?? null) : null
    node.lowerBranch = s.lowerBranchId ? (map.get(s.lowerBranchId) ?? null) : null
  }

  const root = map.get(rootId)
  if (!root) throw new Error(`Root node "${rootId}" not found in serialized tree`)
  return root
}

self.onmessage = (event: MessageEvent<FittingRequest>) => {
  if (event.data.type !== 'fit') return
  const req = event.data

  try {
    const root = deserializeNodes(req.nodes, req.rootId)

    // Build a flat lookup so modelFn can write params without traversing the tree each iteration
    const nodeMap = new Map<string, CircuitNode>()
    ;(function collect(n: CircuitNode | null) {
      if (!n) return
      nodeMap.set(n.id, n)
      collect(n.next)
      collect(n.upperBranch)
      collect(n.lowerBranch)
    })(root)

    const modelFn = (params: number[], omegas: number[]) => {
      for (let i = 0; i < req.paramRefs.length; i++) {
        const ref = req.paramRefs[i]!
        const node = nodeMap.get(ref.nodeId)!
        const minLim = ref.param === 'value' ? node.min : node.min2
        const maxLim = ref.param === 'value' ? node.max : node.max2
        node[ref.param] = Math.min(Math.max(params[i] ?? 1e-3, minLim ?? 1e-20), maxLim ?? 1e20)
      }
      return omegas.map(omega => zOfChain(root, omega))
    }

    const initialParams = req.paramRefs.map(r => {
      const node = nodeMap.get(r.nodeId)!
      const v = node[r.param]
      return isNaN(v) || v == null ? 1e-3 : Math.max(v, 1e-20)
    })

    const result = fitCircuit({
      frequencies: req.frequencies,
      zReal: req.zReal,
      zImag: req.zImag,
      modelFn,
      initialParams,
      minValues: req.minValues,
      maxValues: req.maxValues,
    })

    const response: FittingResponse = {
      type: 'result',
      fittedValues: result.params,
      chiSquared: result.chiSquared,
      iterations: result.iterations,
    }
    self.postMessage(response)
  } catch (err) {
    const response: FittingResponse = {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    }
    self.postMessage(response)
  }
}
