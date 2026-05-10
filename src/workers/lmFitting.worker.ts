/// <reference lib="webworker" />

import { CircuitNode } from '@/utils/CircuitNode'
import { zOfChain } from '@/utils/circuitImpedance'
import { fitCircuit } from '@/utils/lmFitting'
import type { FittingRequest, FittingResponse, SerializedNode } from '@/types/fittingWorkerProtocol'

//Webworker har inten åtkomst till DOM eller Vue app. Behöver återuppbygga CircuitNode-trädet från serialiserade data.

function deserializeNodes(nodes: SerializedNode[], rootId: string): CircuitNode {
  // Pass 1: skapar alla noder utan att sätta länkar. Sparar i en map.
  const map = new Map<string, CircuitNode>()
  for (const s of nodes) {
    const node = new CircuitNode(s.id, s.type, s.value, s.value2)
    node.locked = s.locked
    node.locked2 = s.locked2
    map.set(s.id, node)
  }

  // Pass 2:  sätter länkar baserat på ID:n (next, upperBranch, lowerBranch)
  for (const s of nodes) {
    const node = map.get(s.id)!
    node.next        = s.nextId        ? (map.get(s.nextId)        ?? null) : null
    node.upperBranch = s.upperBranchId ? (map.get(s.upperBranchId) ?? null) : null
    node.lowerBranch = s.lowerBranchId ? (map.get(s.lowerBranchId) ?? null) : null
  }

//returnerar roten av det återuppbyggda trädet
  const root = map.get(rootId)
  if (!root) throw new Error(`Root node "${rootId}" not found in serialized tree`)
  return root
}

//startar LM-fittning när main thread skickar en "fit" request
self.onmessage = (event: MessageEvent<FittingRequest>) => {
  if (event.data.type !== 'fit') return
  const req = event.data

  try {
    const root = deserializeNodes(req.nodes, req.rootId)

    //Byyger en flat lookup så modelFn kan skriva params utan att gå igenom trädet varje iteration.

    const nodeMap = new Map<string, CircuitNode>()
    ;(function collect(n: CircuitNode | null) {
      if (!n) return
      nodeMap.set(n.id, n)
      collect(n.next)
      collect(n.upperBranch)
      collect(n.lowerBranch)
    })(root)

    //modelFN uppdaterar nodvärdena i trädet baserat på params-arrayen och returnerar modellens Z-värden för alla frekvenser.
    const modelFn = (params: number[], omegas: number[]) => {
      for (let i = 0; i < req.paramRefs.length; i++) {
        const ref = req.paramRefs[i]!
        const node = nodeMap.get(ref.nodeId)!
        node[ref.param] = params[i] ?? 1e-3
      }
      return omegas.map(omega => zOfChain(root, omega))
    }

    const initialParams = req.paramRefs.map(r => {
      const node = nodeMap.get(r.nodeId)!
      const v = node[r.param]
      return isNaN(v) || v == null ? 1e-3 : Math.max(v, 1e-20)
    })

    // Kör LM-fittning
    const result = fitCircuit({
      frequencies: req.frequencies,
      zReal: req.zReal,
      zImag: req.zImag,
      modelFn,
      initialParams,
    })

      //Skickar tillbaka resultatet till main thread

    const response: FittingResponse = {
      type: 'result',
      fittedValues: result.params,
      paramErrors: result.paramErrors,
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
