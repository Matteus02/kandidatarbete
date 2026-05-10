import { ref, onUnmounted } from 'vue'
import type { Ref } from 'vue'
import type { CircuitNode, ElementType } from '@/utils/CircuitNode'
import type { EisDataPoint } from '@/types/eis'
import FittingWorker from '@/workers/lmFitting.worker.ts?worker'
import type { FittingRequest, FittingResponse, SerializedNode } from '@/types/fittingWorkerProtocol'
import { detectArcPeaks, estimateWarburgA, rFromPeak } from '@/utils/heuristics'

// typ för en funktion som samlar ihop alla noder i kretsen
type CollectFn = (node: CircuitNode | null) => CircuitNode[]

// Gör om trädstrukturen till en platt array så att vår web worker kan läsa den
function serializeTree(root: CircuitNode): SerializedNode[] {
  const visited = new Set<string>() // håller koll så vi inte fastnar i en evig loop
  const result: SerializedNode[] = []

  function visit(node: CircuitNode | null) {
    // om noden är null eller redan har besökts, hoppa ur
    if (!node || visited.has(node.id)) return

    visited.add(node.id)

    // spara ner all info vi behöver i arrayen
    result.push({
      id:            node.id,
      type:          node.type,
      value:         node.value,
      value2:        node.value2,
      nextId:        node.next?.id         ?? null,
      upperBranchId: node.upperBranch?.id  ?? null,
      lowerBranchId: node.lowerBranch?.id  ?? null,
      locked:        node.locked,
      locked2:       node.locked2,
    })

    // kör rekursivt på nästa nod och eventuella grenar
    visit(node.next)
    visit(node.upperBranch)
    visit(node.lowerBranch)
  }

  visit(root)
  return result
}

// Composable för att hantera själva Levenberg-Marquardt fittingen
export function useLMFitting(
  rootNode: Ref<CircuitNode>,
  getEisData: () => EisDataPoint[],
  collectNodes: CollectFn,
  onRedraw: () => void,
  morphNode: (node: CircuitNode, newType: ElementType) => void,
) {
  const isFitting = ref(false) // laddnings-state för UI:t
  const paramErrors = ref<Record<string, number>>({}) // sparar felmarginaler för parametrarna

  let fittingWorker: Worker | null = null

  // lazy-loadar workern bara när den faktiskt behövs för att spara resurser
  function getFittingWorker(): Worker {
    if (!fittingWorker) fittingWorker = new FittingWorker()
    return fittingWorker
  }

  // städa upp workern när komponenten förstörs så vi inte läcker minne
  onUnmounted(() => {
    if (fittingWorker) {
      fittingWorker.terminate()
      fittingWorker = null
    }
  })

  // Försöker gissa bra startvärden så att optimeringen inte blir knas
  function estimateInitialValues() {
    const data = getEisData()
    if (data.length === 0) return // ingen data, inget att göra

    // sortera från högsta till lägsta frekvens
    const sorted = [...data].sort((a, b) => b['freq/Hz'] - a['freq/Hz'])
    const reZ  = sorted.map(d => d['Re(Z)/Ohm'])
    const imZ  = sorted.map(d => d['-Im(Z)/Ohm'])
    const freq = sorted.map(d => d['freq/Hz'])
    const N    = sorted.length

    // Rs är typ serieresistansen, tar första värdet (vid hög frekvens) som gissning
    const Rs    = Math.max(reZ[0] ?? 1, 1)
    const ReMax = Math.max(...reZ)

    // hitta topparna i datan
    const arcPeaks = detectArcPeaks(sorted)
    const warburgA = estimateWarburgA(sorted, Rs)

    let arcIdx     = 0
    let seriesRIdx = 0

    // räknar hur många parallella block vi har i kretsen
    function countParallelBlocks(node: CircuitNode | null): number {
      if (!node || node.type === 'end') return 0
      return (node.type === 'parallel' ? 1 : 0) + countParallelBlocks(node.next)
    }
    const numParallelBlocks = Math.max(countParallelBlocks(rootNode.value), 1)

    // letar efter en kondensator (eller liknande) i kedjan
    function findCapInChain(node: CircuitNode | null): CircuitNode | null {
      if (!node || node.type === 'end') return null
      if (node.type === 'C' || node.type === 'CPE') return node
      return findCapInChain(node.next)
    }

    // går igenom noderna och sätter startvärden beroende på vad det är för komponent
    function assignNode(node: CircuitNode | null) {
      if (!node || node.type === 'end') return

      switch (node.type) {
        case 'R': {
          if (!node.locked) {
            // första R brukar vara Rs, annars gissar vi på 5% av maxbredden typ
            const est = seriesRIdx === 0
              ? Rs
              : Math.max((ReMax - Rs) * 0.05, 1)
            node.value = est
          }
          seriesRIdx++
          break
        }

        case 'parallel': {
          const arc    = arcPeaks[arcIdx] ?? arcPeaks[arcPeaks.length - 1] ?? { f: 1, imPeak: (ReMax - Rs) / 2 }
          const fallbackScale = arcIdx >= arcPeaks.length ? 1 / numParallelBlocks : 1
          arcIdx++

          const omegaC = 2 * Math.PI * arc.f
          const capNode = findCapInChain(node.upperBranch) ?? findCapInChain(node.lowerBranch)
          const nEst = capNode?.type === 'CPE' ? 0.85 : 1 // gissar n-värdet för CPE

          const Rp   = rFromPeak(arc.imPeak, nEst) * fallbackScale

          // sätter värden på båda grenarna i det parallella blocket
          assignBranch(node.upperBranch, Rp, omegaC)
          assignBranch(node.lowerBranch, Rp, omegaC)
          break
        }

        case 'C':
        case 'CPE': {
          const arc    = arcPeaks[arcIdx] ?? arcPeaks[arcPeaks.length - 1] ?? { f: 1, imPeak: 10 }
          arcIdx++
          const Rp     = rFromPeak(arc.imPeak, node.type === 'CPE' ? 0.85 : 1)
          const omegaC = 2 * Math.PI * arc.f
          assignCapacitive(node, Rp, omegaC)
          break
        }

        case 'W':
          if (!node.locked) {
            node.value = warburgA
          }
          break

        case 'Wo':
        case 'Ws': {
          const omegaLow = 2 * Math.PI * (freq[N - 1] ?? 0.01)
          if (!node.locked) {
            node.value = Math.max(warburgA * Math.SQRT2, 1)
          }
          if (!node.locked2) {
            node.value2 = Math.max(1 / omegaLow, 1e-4)
          }
          break
        }

        case 'L': {
          if (!node.locked) {
            const imHF = imZ[0] ?? 0
            // gissar induktans baserat på första högfrekventa punkten
            const est = imHF < 0
              ? Math.abs(imHF) / (2 * Math.PI * (freq[0] ?? 1))
              : 1e-6
            node.value = est
          }
          break
        }
      }

      assignNode(node.next) // vidare till nästa!
    }

    // hjälpfunk för att sätta värden inne i ett parallellt block
    function assignBranch(node: CircuitNode | null, Rp: number, omegaC: number) {
      if (!node || node.type === 'end') return
      switch (node.type) {
        case 'R':
          if (!node.locked) {
            node.value = Rp
          }
          break
        case 'C':
        case 'CPE':
          assignCapacitive(node, Rp, omegaC)
          break
        case 'W':
          if (!node.locked) {
            node.value = warburgA
          }
          break
        case 'Wo':
        case 'Ws':
          if (!node.locked) {
            node.value = Math.max(Rp * 0.5, 1)
          }
          if (!node.locked2) {
            node.value2 = Math.max(1 / omegaC, 1e-4)
          }
          break
        case 'L':
          if (!node.locked) {
            node.value = 1e-6
          }
          break
      }
      if (node.next) assignBranch(node.next, Rp, omegaC)
    }

    // räknar ut C baserat på Rp och omega
    function assignCapacitive(node: CircuitNode, Rp: number, omegaC: number) {
      if (node.type === 'C') {
        if (!node.locked) {
          node.value = 1 / (Math.max(Rp, 1) * omegaC)
        }
      } else if (node.type === 'CPE') {
        if (!node.locked2) {
          node.value2 = 0.85
        }
        if (!node.locked) {
          node.value = 1 / (Math.max(Rp, 1) * Math.pow(omegaC, node.value2))
        }
      }
    }

    // kör igång hela startvärdes-processen från roten
    assignNode(rootNode.value)
    onRedraw()

    // sen kör vi själva fittingen direkt efter
    fitModel()
  }

  // Huvudfunktionen som skickar datan till workern för att optimera modellen
  async function fitModel() {
    const data = getEisData()
    if (data.length === 0) {
      alert('No measurement data to fit against!')
      return
    }

    isFitting.value = true
    paramErrors.value = {}

    // filtrera fram bara de komponenter vi faktiskt kan optimera
    const optimizableNodes = collectNodes(rootNode.value).filter(n =>
      ['R', 'C', 'CPE', 'W', 'Wo', 'Ws', 'L'].includes(n.type),
    )

    if (optimizableNodes.length === 0) {
      isFitting.value = false
      return
    }

    // bygger en lista på vilka specifika parametrar som ska optimeras
    type ParamRef = { node: CircuitNode; param: 'value' | 'value2' }
    const paramRefs: ParamRef[] = []
    for (const node of optimizableNodes) {
      if (node.locked === false) {
        paramRefs.push({ node, param: 'value' })
      }
      if ((node.type === 'Wo' || node.type === 'Ws' || node.type === 'CPE') && node.locked2 === false) {
        paramRefs.push({ node, param: 'value2' })
      }
    }

    if (paramRefs.length === 0) {
      alert('All parameters are locked. Unlock at least one to perform fitting.')
      isFitting.value = false
      return
    }

    const sorted = [...data].sort((a, b) => a['freq/Hz'] - b['freq/Hz'])
    const frequencies = sorted.map(d => d['freq/Hz'])
    const zReal = sorted.map(d => d['Re(Z)/Ohm'])
    const zImag = sorted.map(d => d['-Im(Z)/Ohm'])

    // bygger request-objektet som vi ska posta till workern
    const request: FittingRequest = {
      type: 'fit',
      nodes: serializeTree(rootNode.value),
      rootId: rootNode.value.id,
      frequencies,
      zReal,
      zImag,
      paramRefs: paramRefs.map(r => ({ nodeId: r.node.id, param: r.param })),
    }

    try {
      // väntar på svar från workern
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

      // uppdaterar UI:t med de nya uträknade värdena och felmarginalerna
      const errors: Record<string, number> = {}
      for (let i = 0; i < paramRefs.length; i++) {
        const ref = paramRefs[i]!
        ref.node[ref.param] = response.fittedValues[i] ?? 1e-3
        errors[`${ref.node.id}:${ref.param}`] = response.paramErrors[i] ?? 0
      }
      paramErrors.value = errors
      onRedraw()

      // letar reda på sista noden (svansen) i huvudkedjan
      let tailNode = rootNode.value
      while (tailNode.next && tailNode.next.type !== 'end') {
        tailNode = tailNode.next
      }

      // om sista noden är en CPE, kollar vi n-värdet.
      // Är det typ 0.5 gör vi om den till en Warburg. Är det nära 1 blir det en kondensator.
      if (tailNode && tailNode.type === 'CPE') {
        const n = tailNode.value2 ?? 0
        if (n > 0.42 && n < 0.58) {
          morphNode(tailNode, 'W')
        } else if (n > 0.85) {
          morphNode(tailNode, 'C')
        }
      }

    } catch (err) {
      console.error('LM fitting failed:', err)
      const msg = err instanceof Error ? err.message : String(err)
      alert(`Fitting error: ${msg.slice(0, 300)}`)
    } finally {
      // släck laddnings-spinnern oavsett om det gick bra eller krashade
      isFitting.value = false
    }
  }

  return { isFitting, paramErrors, estimateInitialValues, fitModel }
}
