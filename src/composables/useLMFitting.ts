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
//     Runs the Levenberg-Marquardt algorithm from ml-levenberg-marquardt.
//     All parameters are optimised in log-space so that resistances (100s Ω)
//     and capacitances (1e-6 F) have equal influence on the step size.
//     Modulus weighting (error / |Z|²) balances low- and high-impedance ranges.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { CircuitNode } from '@/components/circuit/CircuitNode'
import type { EisDataPoint } from '@/types/eis'
import { zOfChain } from '@/utils/circuitImpedance'
import { fitCircuit } from '@/utils/lmFitting'
import type { CircuitModelFn } from '@/utils/lmFitting'

type CollectFn = (node: CircuitNode | null) => CircuitNode[]

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
        case 'CPE':
          node.value = 1 / (omegaPeak * Math.max(arcShare, 1))
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

  // ── Levenberg-Marquardt Curve Fitting ────────────────────────────────────

  function fitModel() {
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
      if (node.type === 'Wo' || node.type === 'Ws') {
        paramRefs.push({ node, param: 'value2' })
      }
    }

    const initialParams = paramRefs.map(r => {
      const v = r.node[r.param]
      return isNaN(v) || v == null ? 1e-3 : Math.max(v, 1e-20)
    })

    const sorted = [...data].sort((a, b) => a['freq/Hz'] - b['freq/Hz'])
    const frequencies = sorted.map(d => d['freq/Hz'])
    const zReal       = sorted.map(d => d['Re(Z)/Ohm'])
    const zImag       = sorted.map(d => d['-Im(Z)/Ohm'])

    // Build model function: writes params into the circuit tree and evaluates zOfChain.
    const modelFn: CircuitModelFn = (params, omegas) => {
      for (let i = 0; i < paramRefs.length; i++) {
        const ref = paramRefs[i]!
        ref.node[ref.param] = Math.min(Math.max(params[i] ?? 1e-3, 1e-20), 1e20)
      }
      return omegas.map(omega => zOfChain(rootNode.value, omega))
    }

    try {
      const result = fitCircuit({ frequencies, zReal, zImag, modelFn, initialParams })

      console.log(
        `LM fit converged in ${result.iterations} iterations. χ² = ${result.chiSquared.toExponential(3)}`,
      )
      console.log(
        'Fitted params:',
        result.params.map((p, i) => {
          const ref = paramRefs[i]!
          return `${ref.node.id}.${ref.param} = ${p.toPrecision(4)}`
        }),
      )

      // Write fitted values back to the circuit tree
      for (let i = 0; i < paramRefs.length; i++) {
        const ref = paramRefs[i]!
        ref.node[ref.param] = Math.min(Math.max(result.params[i] ?? 1e-3, 1e-25), 1e25)
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
