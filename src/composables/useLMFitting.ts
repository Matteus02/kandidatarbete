// Vue composable for EIS circuit parameter fitting using Levenberg-Marquardt.
//
// Provides two functions:
//
//   estimateInitialValues
//     Reads three features from the Nyquist plot shape to set physically
//     meaningful starting parameters before optimisation:
//       - High-frequency intercept  → first series R
//       - Semicircle arc diameter   → parallel R values and C/CPE frequencies
//       - Low-frequency tail        → Warburg coefficient
//
//   fitModel
//     Sends the circuit tree and EIS data to a Web Worker that runs the
//     Levenberg-Marquardt algorithm from ml-levenberg-marquardt.
//     All parameters are optimised in log-space so that resistances (100s Ω)
//     and capacitances (1e-6 F) have equal influence on the step size.
//     CPE n is bounded [0.1, 1.0]. Modulus weighting balances low- and
//     high-impedance ranges. Results are written back to the reactive tree
//     on the main thread after the worker responds.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { CircuitNode } from '@/components/circuit/CircuitNode'
import type { EisDataPoint } from '@/types/eis'
import FittingWorker from '@/workers/lmFitting.worker.ts?worker'
import type { FittingRequest, FittingResponse, SerializedNode } from '@/ai/fittingWorkerProtocol'

type CollectFn = (node: CircuitNode | null) => CircuitNode[]

// Module-level worker instance — reused across fits, lazily created on first use.
let fittingWorker: Worker | null = null
function getFittingWorker(): Worker {
  if (!fittingWorker) fittingWorker = new FittingWorker()
  return fittingWorker
}

// Serialise the full circuit tree to a flat JSON-safe array.
// Includes ALL node types (parallel, end) because zOfChain traverses them.
function serializeTree(root: CircuitNode): SerializedNode[] {
  const visited = new Set<string>()
  const result: SerializedNode[] = []

  function visit(node: CircuitNode | null) {
    if (!node || visited.has(node.id)) return
    visited.add(node.id)
    result.push({
      id:            node.id,
      type:          node.type,
      value:         node.value,
      value2:        node.value2,
      nextId:        node.next?.id         ?? null,
      upperBranchId: node.upperBranch?.id  ?? null,
      lowerBranchId: node.lowerBranch?.id  ?? null,
    })
    visit(node.next)
    visit(node.upperBranch)
    visit(node.lowerBranch)
  }

  visit(root)
  return result
}

export function useLMFitting(
  rootNode: Ref<CircuitNode>,
  getEisData: () => EisDataPoint[],
  collectNodes: CollectFn,
  onRedraw: () => void,
) {
  const isFitting = ref(false)

  // ── Heuristic Initial Value Estimation ──────────────────────────────────

  function estimateInitialValues() {
    const data = getEisData()
    if (data.length === 0) return

    const sorted = [...data].sort((a, b) => b['freq/Hz'] - a['freq/Hz'])
    const reZ    = sorted.map(d => d['Re(Z)/Ohm'])
    const imZ    = sorted.map(d => d['-Im(Z)/Ohm'])
    const freq   = sorted.map(d => d['freq/Hz'])

    const zHF       = Math.min(...reZ)
    const totalArc  = Math.max(...reZ) - zHF
    const maxImIdx  = imZ.indexOf(Math.max(...imZ))
    const peakFreq  = freq[maxImIdx] ?? freq[0] ?? 1
    const omegaPeak = 2 * Math.PI * peakFreq
    const omegaLow  = 2 * Math.PI * (freq[freq.length - 1] ?? 0.01)

    const allNodes      = collectNodes(rootNode.value)
    const parallelCount = Math.max(1, allNodes.filter(n => n.type === 'parallel').length)

    let seriesRSeen = 0

    function assignNode(node: CircuitNode | null) {
      if (!node || node.type === 'end') return
      const arcShare = totalArc / parallelCount

      switch (node.type) {
        case 'R':
          node.value = seriesRSeen === 0 ? Math.max(zHF, 1) : Math.max(arcShare, 1)
          seriesRSeen++
          break
        case 'C':
          node.value = 1 / (omegaPeak * Math.max(arcShare, 1))
          break
        case 'CPE':
          node.value  = 1 / (omegaPeak * Math.max(arcShare, 1))
          node.value2 = 0.85
          break
        case 'W': {
          const reLow = reZ[reZ.length - 1] ?? 100
          node.value  = Math.max((reLow - zHF) * Math.sqrt(2 * omegaLow), 1)
          break
        }
        case 'Wo':
        case 'Ws':
          node.value  = Math.max(arcShare * 0.5, 1)
          node.value2 = Math.max(1 / omegaPeak, 1e-4)
          break
        case 'L': {
          const imHF = imZ[0] ?? 0
          node.value  = imHF < 0 ? Math.abs(imHF) / (2 * Math.PI * (freq[0] ?? 1)) : 1e-6
          break
        }
      }

      if (node.upperBranch) assignNode(node.upperBranch)
      if (node.lowerBranch) assignNode(node.lowerBranch)
      if (node.next)        assignNode(node.next)
    }

    assignNode(rootNode.value)
    onRedraw()
  }

  // ── Levenberg-Marquardt Curve Fitting (Web Worker) ───────────────────────

  async function fitModel() {
    const data = getEisData()
    if (data.length === 0) {
      alert('No measurement data to fit against!')
      return
    }

    isFitting.value = true

    const optimizableNodes = collectNodes(rootNode.value).filter(n =>
      ['R', 'C', 'CPE', 'W', 'Wo', 'Ws', 'L'].includes(n.type),
    )

    if (optimizableNodes.length === 0) {
      isFitting.value = false
      return
    }

    type ParamRef = { node: CircuitNode; param: 'value' | 'value2' }
    const paramRefs: ParamRef[] = []
    for (const node of optimizableNodes) {
      paramRefs.push({ node, param: 'value' })
      if (node.type === 'Wo' || node.type === 'Ws' || node.type === 'CPE') {
        paramRefs.push({ node, param: 'value2' })
      }
    }

    const minValues = paramRefs.map(r =>
      r.node.type === 'CPE' && r.param === 'value2' ? 0.1 : 1e-20,
    )
    const maxValues = paramRefs.map(r =>
      r.node.type === 'CPE' && r.param === 'value2' ? 1.0 : 1e20,
    )

    const sorted     = [...data].sort((a, b) => a['freq/Hz'] - b['freq/Hz'])
    const frequencies = sorted.map(d => d['freq/Hz'])
    const zReal       = sorted.map(d => d['Re(Z)/Ohm'])
    const zImag       = sorted.map(d => d['-Im(Z)/Ohm'])

    const request: FittingRequest = {
      type:      'fit',
      nodes:     serializeTree(rootNode.value),
      rootId:    rootNode.value.id,
      frequencies,
      zReal,
      zImag,
      minValues,
      maxValues,
      paramRefs: paramRefs.map(r => ({ nodeId: r.node.id, param: r.param })),
    }

    try {
      const response = await new Promise<FittingResponse>((resolve, reject) => {
        const w = getFittingWorker()
        const onMessage = (event: MessageEvent<FittingResponse>) => {
          w.removeEventListener('message', onMessage)
          w.removeEventListener('error', onError)
          resolve(event.data)
        }
        const onError = (e: ErrorEvent) => {
          w.removeEventListener('message', onMessage)
          w.removeEventListener('error', onError)
          reject(new Error(e.message))
        }
        w.addEventListener('message', onMessage)
        w.addEventListener('error', onError)
        w.postMessage(request)
      })

      if (response.type === 'error') throw new Error(response.message)

      console.log(
        `LM fit converged in ${response.iterations} iterations. χ² = ${response.chiSquared.toExponential(3)}`,
      )
      console.log(
        'Fitted params:',
        response.fittedValues.map((p, i) => {
          const ref = paramRefs[i]!
          return `${ref.node.id}.${ref.param} = ${p.toPrecision(4)}`
        }),
      )

      for (let i = 0; i < paramRefs.length; i++) {
        const ref = paramRefs[i]!
        ref.node[ref.param] = Math.min(Math.max(response.fittedValues[i] ?? 1e-3, 1e-25), 1e25)
      }
      onRedraw()
    } catch (err) {
      console.error('LM fitting failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Fitting error: ${msg.slice(0, 120)}. Try "Estimate Initial Values" first.`)
    } finally {
      isFitting.value = false
    }
  }

  return { isFitting, estimateInitialValues, fitModel }
}
