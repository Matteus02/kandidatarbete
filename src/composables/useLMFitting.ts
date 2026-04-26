// Vue composable for EIS circuit parameter fitting using Levenberg-Marquardt.
//
// Provides two functions:
//
//   estimateInitialValues
//     Reads five features from the EIS spectrum to set physically meaningful
//     starting parameters before optimisation:
//       - Re(Z) at highest frequency      → first series R (ohmic intercept)
//       - -Im(Z) peak amplitudes          → parallel R per arc,
//                                           via R = 2·Im_peak / tan(n·π/4)
//       - -Im(Z) peak frequencies         → C or CPE-Q per arc,
//                                           via C = 1/(R·ωp) or Q = 1/(R·ωp^n)
//       - Low-frequency 1/√ω regression  → Warburg coefficient A (W, Wo, Ws);
//                                           Wo/Ws also get τ = 1/ω_lowest
//       - High-frequency Im(Z) sign       → inductance L = |Im(Z_HF)| / ω_HF
//                                           (only when Im(Z) is negative at HF)
//     Arc peaks are detected with light 3-point smoothing and a 5 % prominence
//     threshold; if no peak is found the global -Im(Z) maximum is used as a
//     fallback. Peaks are consumed in high-to-low frequency order, matching
//     parallel blocks encountered during the tree walk.
//
//   fitModel
//     Sends the circuit tree and EIS data to a Web Worker that runs the
//     Levenberg-Marquardt algorithm from ml-levenberg-marquardt.
//     All parameters are optimised in log-space so that resistances (100s Ω)
//     and capacitances (1e-6 F) have equal influence on the step size.
//     CPE n is bounded [0.1, 1.0]. Modulus weighting balances low- and
//     high-impedance ranges. Results are written back to the reactive tree
//     on the main thread after the worker responds.

import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { CircuitNode } from '@/components/circuit/CircuitNode'
import type { EisDataPoint } from '@/types/eis'
import FittingWorker from '@/workers/lmFitting.worker.ts?worker'
import type { FittingRequest, FittingResponse, SerializedNode } from '@/ai/fittingWorkerProtocol'

type CollectFn = (node: CircuitNode | null) => CircuitNode[]

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

  // Component-scoped worker instance.
  let fittingWorker: Worker | null = null
  function getFittingWorker(): Worker {
    if (!fittingWorker) fittingWorker = new FittingWorker()
    return fittingWorker
  }

  onUnmounted(() => {
    if (fittingWorker) {
      fittingWorker.terminate()
      fittingWorker = null
    }
  })

  // ── Heuristic Initial Value Estimation ──────────────────────────────────

  function estimateInitialValues() {
    const data = getEisData()
    if (data.length === 0) return

    // Sort high→low frequency (standard EIS presentation order)
    const sorted = [...data].sort((a, b) => b['freq/Hz'] - a['freq/Hz'])
    const reZ  = sorted.map(d => d['Re(Z)/Ohm'])
    const imZ  = sorted.map(d => d['-Im(Z)/Ohm'])  // positive = capacitive (EIS convention)
    const freq = sorted.map(d => d['freq/Hz'])
    const N    = sorted.length

    // ── 1. Series resistance ─────────────────────────────────────────────
    // Re(Z) at highest frequency: CPE/C are nearly short-circuits at high ω,
    // so only the ohmic series resistance contributes.
    const Rs    = Math.max(reZ[0] ?? 1, 1)
    const ReMax = Math.max(...reZ)

    // ── 2. Detect individual RC arcs ─────────────────────────────────────
    // Each parallel R-(C|CPE) block produces one peak in -Im(Z).
    // Light 3-point smoothing suppresses noise before peak detection.
    const smoothed: number[] = imZ.map((_, i) => {
      const lo = Math.max(0, i - 1)
      const hi = Math.min(N - 1, i + 1)
      let s = 0
      for (let k = lo; k <= hi; k++) s += imZ[k]!
      return s / (hi - lo + 1)
    })
    const globalMaxIm = Math.max(...smoothed, 1e-30)
    const minProm     = globalMaxIm * 0.05   // ignore spikes < 5 % of the tallest arc

    const arcPeaks: { f: number; imPeak: number }[] = []
    for (let i = 1; i < N - 1; i++) {
      const v = smoothed[i]!
      if (v > smoothed[i - 1]! && v >= smoothed[i + 1]! && v >= minProm) {
        arcPeaks.push({ f: freq[i]!, imPeak: imZ[i]! })
      }
    }
    // Fallback: no local max found (e.g. monotone data) — use global maximum
    if (arcPeaks.length === 0) {
      const idx = smoothed.indexOf(globalMaxIm)
      arcPeaks.push({ f: freq[idx] ?? 1, imPeak: Math.max(imZ[idx] ?? 1, 1) })
    }
    // arcPeaks is already ordered high→low frequency because the input is sorted that way.

    // ── 3. Warburg coefficient from low-frequency 45° tail ───────────────
    // For a semi-infinite Warburg: -Im(Z_W) = A/√(2ω) = (A/√2)·(1/√ω)
    // Regress imZ vs 1/√ω over the lowest-frequency points; slope = A/√2.
    const nLow  = Math.max(3, Math.min(7, Math.floor(N / 4)))
    const lowPts = sorted.slice(N - nLow)
    let warburgA = Math.max((ReMax - Rs) * Math.sqrt(2 * Math.PI * (freq[N - 1] ?? 0.01)), 1)
    if (lowPts.length >= 2) {
      let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0
      for (const d of lowPts) {
        const x = 1 / Math.sqrt(2 * Math.PI * Math.max(d['freq/Hz'], 1e-10))
        const y = d['-Im(Z)/Ohm']
        sumX  += x;  sumY  += y
        sumXX += x * x;  sumXY += x * y
      }
      const nL  = lowPts.length
      const det = nL * sumXX - sumX * sumX
      if (det > 1e-30) {
        const slope = (nL * sumXY - sumX * sumY) / det   // slope = A / √2
        warburgA = Math.max(slope * Math.SQRT2, 1)
      }
    }

    // ── 4. Walk the circuit tree and assign ──────────────────────────────
    // arcIdx tracks which detected peak is assigned to the next parallel block
    // (high-frequency arc → first parallel block, etc.).
    let arcIdx     = 0
    let seriesRIdx = 0

    // For a parallel R-CPE arc the peak condition gives R·Q·ωp^n = 1, so:
    //   Q = 1 / (R · ωp^n)
    // The -Im(Z) amplitude at the peak equals R/2 · tan(n·π/4), so:
    //   R = 2 · Im_peak / tan(n·π/4)
    // For n = 1 (capacitor) this reduces to R = 2 · Im_peak, the standard result.
    function rFromPeak(imPeak: number, n: number): number {
      const t = Math.tan((n * Math.PI) / 4)
      return Math.max((2 * imPeak) / (t > 0 ? t : 1), 1)
    }

    // Walk a chain (following .next) and return the first C or CPE node found, or null.
    function findCapInChain(node: CircuitNode | null): CircuitNode | null {
      if (!node || node.type === 'end') return null
      if (node.type === 'C' || node.type === 'CPE') return node
      return findCapInChain(node.next)
    }

    function assignNode(node: CircuitNode | null) {
      if (!node || node.type === 'end') return

      switch (node.type) {
        case 'R': {
          node.value = seriesRIdx === 0
            ? Rs
            // Inner series R: use a small fraction of the total Re span as a safe seed
            : Math.max((ReMax - Rs) * 0.05, 1)
          seriesRIdx++
          break
        }

        case 'parallel': {
          // Consume the next highest-frequency arc peak for this parallel block.
          const arc    = arcPeaks[arcIdx] ?? arcPeaks[arcPeaks.length - 1] ?? { f: 1, imPeak: (ReMax - Rs) / 2 }
          arcIdx++
          const omegaC = 2 * Math.PI * arc.f
          // Determine n from whichever capacitive element sits in either branch,
          // then compute one shared R_p so R and C/CPE stay self-consistent.
          const capNode = findCapInChain(node.upperBranch) ?? findCapInChain(node.lowerBranch)
          const nEst = capNode?.type === 'CPE' ? 0.85 : 1
          const Rp   = rFromPeak(arc.imPeak, nEst)
          assignBranch(node.upperBranch, Rp, omegaC)
          assignBranch(node.lowerBranch, Rp, omegaC)
          break
        }

        case 'C':
        case 'CPE': {
          // Lone capacitive element outside a parallel block
          const arc    = arcPeaks[arcIdx] ?? arcPeaks[arcPeaks.length - 1] ?? { f: 1, imPeak: 10 }
          arcIdx++
          const Rp     = rFromPeak(arc.imPeak, node.type === 'CPE' ? 0.85 : 1)
          const omegaC = 2 * Math.PI * arc.f
          assignCapacitive(node, Rp, omegaC)
          break
        }

        case 'W':
          node.value = warburgA
          break

        case 'Wo':
        case 'Ws': {
          const omegaLow = 2 * Math.PI * (freq[N - 1] ?? 0.01)
          node.value  = Math.max(warburgA * Math.SQRT2, 1)  // Rw ≈ diffusion plateau
          node.value2 = Math.max(1 / omegaLow, 1e-4)        // τ ≈ 1 / ω_lowest
          break
        }

        case 'L': {
          const imHF = imZ[0] ?? 0
          node.value = imHF < 0
            ? Math.abs(imHF) / (2 * Math.PI * (freq[0] ?? 1))
            : 1e-6
          break
        }
      }

      assignNode(node.next)
    }

    // Assign a single element inside a parallel branch.
    // Rp = parallel resistance for this arc, omegaC = arc's characteristic frequency.
    function assignBranch(node: CircuitNode | null, Rp: number, omegaC: number) {
      if (!node || node.type === 'end') return
      switch (node.type) {
        case 'R':
          node.value = Rp
          break
        case 'C':
        case 'CPE':
          assignCapacitive(node, Rp, omegaC)
          break
        case 'W':
          node.value = warburgA
          break
        case 'Wo':
        case 'Ws':
          node.value  = Math.max(Rp * 0.5, 1)
          node.value2 = Math.max(1 / omegaC, 1e-4)
          break
        case 'L':
          node.value = 1e-6
          break
      }
      // Follow a chain within the branch (handles nested series elements inside a branch)
      if (node.next) assignBranch(node.next, Rp, omegaC)
    }

    function assignCapacitive(node: CircuitNode, Rp: number, omegaC: number) {
      if (node.type === 'C') {
        // C = 1 / (R · ω_peak) from the peak condition ω_peak · R · C = 1
        node.value = 1 / (Math.max(Rp, 1) * omegaC)
      } else if (node.type === 'CPE') {
        // Q = 1 / (R · ω_peak^n) from the CPE peak condition R·Q·ω_peak^n = 1
        node.value2 = 0.85
        node.value  = 1 / (Math.max(Rp, 1) * Math.pow(omegaC, 0.85))
      }
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
