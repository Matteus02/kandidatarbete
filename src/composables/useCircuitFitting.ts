// Vue composable for EIS circuit parameter fitting.
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
//     Runs the Nelder-Mead (downhill simplex) algorithm from the `fmin` library.
//     All parameters are optimised in log-space so that resistances (100s Ω)
//     and capacitances (1e-6 F) have equal influence on the optimiser step size.
//     The cost function uses modulus weighting (error / |Z|²) so that low- and
//     high-impedance frequency ranges contribute equally to the total error.

import { ref } from 'vue'
import type { Ref } from 'vue'
import type { CircuitNode } from '@/components/circuit/CircuitNode'
import type { EisDataPoint } from '@/types/eis'
import type { Complex } from '@/utils/complexMath'
import * as fmin from 'fmin'

type ZChainFn  = (node: CircuitNode | null, omega: number) => Complex
type CollectFn = (node: CircuitNode | null) => CircuitNode[]

export function useCircuitFitting(
  rootNode:     Ref<CircuitNode>,
  getEisData:   () => EisDataPoint[],
  collectNodes: CollectFn,
  zOfChain:     ZChainFn,
  onRedraw:     () => void,
) {
  const isFitting = ref(false)

  // ── Heuristic Initial Value Estimation ──────────────────────────────────

  function estimateInitialValues() {
    const data = getEisData()
    if (data.length === 0) return

    // Sort high → low frequency to match the expected Nyquist plot orientation
    const sorted = [...data].sort((a, b) => b['freq/Hz'] - a['freq/Hz'])
    const reZ    = sorted.map(d => d['Re(Z)/Ohm'])
    const imZ    = sorted.map(d => d['-Im(Z)/Ohm'])
    const freq   = sorted.map(d => d['freq/Hz'])

    // Three Nyquist features used to seed the parameters
    const zHF       = Math.min(...reZ)                              // high-freq Re(Z) intercept
    const totalArc  = Math.max(...reZ) - zHF                       // diameter of dominant semicircle
    const maxImIdx  = imZ.indexOf(Math.max(...imZ))
    const peakFreq  = freq[maxImIdx] ?? freq[0] ?? 1               // frequency at arc peak
    const omegaPeak = 2 * Math.PI * peakFreq
    const omegaLow  = 2 * Math.PI * (freq[freq.length - 1] ?? 0.01)

    // Divide the arc diameter evenly across all parallel blocks in the circuit
    const allNodes     = collectNodes(rootNode.value)
    const parallelCount = Math.max(1, allNodes.filter(n => n.type === 'parallel').length)

    let seriesRSeen = 0

    function assignNode(node: CircuitNode | null) {
      if (!node || node.type === 'end') return
      const arcShare = totalArc / parallelCount

      switch (node.type) {
        case 'R':
          // First R in series → high-freq intercept (electrolyte resistance)
          // Subsequent R → share of the total arc diameter
          node.value = seriesRSeen === 0 ? Math.max(zHF, 1) : Math.max(arcShare, 1)
          seriesRSeen++
          break
        case 'C':
        case 'CPE':
          // C = 1 / (ω_peak · R_arc)  — from the RC time-constant at the arc peak
          node.value = 1 / (omegaPeak * Math.max(arcShare, 1))
          break
        case 'W': {
          // Semi-infinite Warburg: Re(Z_W) = A / √(2ω)  →  A = Re_low · √(2ω_low)
          const reLow = reZ[reZ.length - 1] ?? 100
          node.value  = Math.max((reLow - zHF) * Math.sqrt(2 * omegaLow), 1)
          break
        }
        case 'Wo':
        case 'Ws':
          node.value  = Math.max(arcShare * 0.5, 1)       // Rw (DC resistance)
          node.value2 = Math.max(1 / omegaPeak, 1e-4)     // τ (diffusion time constant)
          break
        case 'L': {
          // Z_L = jωL; if Im(Z) is negative at high frequency the sample is inductive
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

  // ── Nelder-Mead Curve Fitting ────────────────────────────────────────────

  function fitModel() {
    const data = getEisData()
    if (data.length === 0) {
      alert('No measurement data to fit against!')
      return
    }

    isFitting.value = true

    // Gather every node with an optimisable parameter
    const optimizableNodes = collectNodes(rootNode.value)
      .filter(n => ['R', 'C', 'CPE', 'W', 'Wo', 'Ws', 'L'].includes(n.type))

    if (optimizableNodes.length === 0) {
      isFitting.value = false
      return
    }

    // Build a flat list of parameter references.
    // Wo and Ws each contribute two entries: value (Rw) and value2 (τ).
    type ParamRef = { node: CircuitNode; param: 'value' | 'value2' }
    const paramRefs: ParamRef[] = []
    for (const node of optimizableNodes) {
      paramRefs.push({ node, param: 'value' })
      if (node.type === 'Wo' || node.type === 'Ws') {
        paramRefs.push({ node, param: 'value2' })
      }
    }

    // Convert to log-space so every parameter starts on the same numerical scale.
    // A step of ±1 in log-space means a 10× change in linear space,
    // regardless of whether the parameter is 1e-9 F or 1e4 Ω.
    const initialLog = paramRefs.map(p => Math.log(Math.max(p.node[p.param], 1e-15)))

    // Cost function: sum of modulus-weighted squared residuals over all frequencies.
    // Modulus weighting divides each squared error by |Z_meas|² so that the
    // low-frequency (high-Z) and high-frequency (low-Z) regions are balanced.
    const costFunction = (logParams: number[]): number => {
      paramRefs.forEach((ref, i) => { ref.node[ref.param] = Math.exp(logParams[i] ?? 0) })

      let totalError = 0
      for (const d of data) {
        const omega  = 2 * Math.PI * d['freq/Hz']
        const measRe = d['Re(Z)/Ohm']
        const measIm = d['-Im(Z)/Ohm']
        const modelZ = zOfChain(rootNode.value, omega)
        const magSq  = measRe * measRe + measIm * measIm || 1e-10
        totalError  += ((measRe - modelZ.re) ** 2 + (measIm - (-modelZ.im)) ** 2) / magSq
      }
      return totalError
    }

    try {
      const solution = fmin.nelderMead(costFunction, initialLog)

      // Write the optimised log-params back to the nodes in linear space
      paramRefs.forEach((ref, i) => { ref.node[ref.param] = Math.exp(solution.x[i] ?? 0) })
      onRedraw()
    } catch (err) {
      console.error('Fitting failed:', err)
      alert('Could not fit the curve. Try "Estimate Initial Values" first to set better starting points.')
    } finally {
      isFitting.value = false
    }
  }

  return { isFitting, estimateInitialValues, fitModel }
}
