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
import { CPE_N } from '@/utils/circuitImpedance'
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
    const zHF       = Math.min(...reZ)
    const totalArc  = Math.max(...reZ) - zHF
    const maxImIdx  = imZ.indexOf(Math.max(...imZ))
    const peakFreq  = freq[maxImIdx] ?? freq[0] ?? 1
    const omegaPeak = 2 * Math.PI * peakFreq
    const omegaLow  = 2 * Math.PI * (freq[freq.length - 1] ?? 0.01)

    // Count parallel blocks by walking the full tree.
    // (collectNodes skips 'parallel' nodes so it cannot be used here.)
    const parallelCount = Math.max(1, countParallelBlocks(rootNode.value))
    const arcShare      = totalArc / parallelCount

    let seriesRSeen = 0

    function assignNode(node: CircuitNode | null) {
      if (!node || node.type === 'end') return

      switch (node.type) {
        case 'R':
          node.value = seriesRSeen === 0 ? Math.max(zHF, 1) : Math.max(arcShare, 1)
          seriesRSeen++
          break
        case 'C':
          node.value = 1 / (omegaPeak * Math.max(arcShare, 1))
          break
        case 'CPE':
          // For CPE the time-constant relation is ω_peak = (1/(R·Q))^(1/n),
          // so Q = 1 / (R · ω_peak^n).  Using plain ω (n=1) gives Q ~3× too
          // small at typical frequencies, which makes the model arc too large.
          node.value = 1 / (Math.pow(omegaPeak, CPE_N) * Math.max(arcShare, 1))
          break
        case 'W': {
          const reLow = reZ[reZ.length - 1] ?? 100
          // Subtract the parallel-block R contributions so we don't double-count
          // them as Warburg. If the lowest-frequency point is still inside the
          // RC arc region the remainder may be ≤ 0; fall back to a small value.
          const reWarburg = Math.max(reLow - zHF - totalArc, 0)
          node.value = Math.max(reWarburg * Math.sqrt(2 * omegaLow), arcShare * 0.1)
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

  // Counts parallel nodes in the full tree (not just leaf elements).
  function countParallelBlocks(node: CircuitNode | null): number {
    if (!node || node.type === 'end') return 0
    const self = node.type === 'parallel' ? 1 : 0
    return self
      + countParallelBlocks(node.upperBranch)
      + countParallelBlocks(node.lowerBranch)
      + countParallelBlocks(node.next)
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

    // Snapshot original values so we can restore them if fitting fails.
    const originalValues = paramRefs.map(p => p.node[p.param])

    // Convert to log-space so every parameter starts on the same numerical scale.
    const initialLog = paramRefs.map(p => {
      const val = p.node[p.param]
      if (isNaN(val) || val === null || val === undefined) {
        console.warn(`Parameter ${p.node.id}.${p.param} is ${val}, defaulting to 1e-3`)
        return Math.log(1e-3)
      }
      return Math.log(Math.max(val, 1e-18))
    })

    // Cost function: sum of modulus-weighted squared residuals over all frequencies.
    const costFunction = (logParams: number[]): number => {
      for (let i = 0; i < paramRefs.length; i++) {
        const ref = paramRefs[i]
        const val = Math.exp(logParams[i] ?? 0)
        // Clamp to prevent extreme values that cause NaN in impedance formulas
        ref.node[ref.param] = Math.min(Math.max(val, 1e-20), 1e20)
      }

      let totalError = 0
      for (const d of data) {
        const omega  = 2 * Math.PI * d['freq/Hz']
        if (omega === 0) continue

        const measRe = d['Re(Z)/Ohm']
        const measIm = d['-Im(Z)/Ohm']
        const modelZ = zOfChain(rootNode.value, omega)

        if (isNaN(modelZ.re) || isNaN(modelZ.im)) {
          // If model fails, return a very high error instead of NaN
          return 1e30
        }

        const magSq  = measRe * measRe + measIm * measIm || 1e-10
        const error  = ((measRe - modelZ.re) ** 2 + (measIm - (-modelZ.im)) ** 2) / magSq
        
        if (!isNaN(error) && isFinite(error)) {
          totalError += error
        }
      }
      return isNaN(totalError) ? 1e30 : totalError
    }

    try {
      // Check if starting point is valid
      const startCost = costFunction(initialLog)
      if (isNaN(startCost) || !isFinite(startCost)) {
        throw new Error(`Initial parameters lead to invalid (NaN) error: ${startCost}`)
      }

      console.log('Starting fit with cost:', startCost)
      const solution = fmin.nelderMead(costFunction, initialLog)
      console.log('Fit finished. Solution:', solution)

      // Write the optimised log-params back to the nodes in linear space
      for (let i = 0; i < paramRefs.length; i++) {
        const ref = paramRefs[i]
        const val = Math.exp(solution.x[i] ?? 0)
        ref.node[ref.param] = Math.min(Math.max(val, 1e-25), 1e25)
      }
      onRedraw()
    } catch (err) {
      // Restore original values so the user's inputs are not overwritten on failure.
      for (let i = 0; i < paramRefs.length; i++) {
        paramRefs[i]!.node[paramRefs[i]!.param] = originalValues[i]!
      }
      onRedraw()

      console.error('Fitting failed details:', err)
      const errorMsg = err instanceof Error ? err.message : String(err)
      if (errorMsg.includes('NaN')) {
        alert(`Could not fit: some parameters became invalid (NaN). Try "Estimate Initial Values" to reset.`)
      } else {
        alert(`Fitting error: ${errorMsg.slice(0, 100)}. Try "Estimate Initial Values" first to set better starting points.`)
      }
    } finally {
      isFitting.value = false
    }
  }

  return { isFitting, estimateInitialValues, fitModel }
}
