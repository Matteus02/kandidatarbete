// Det här är huvud-filen för hela krets-trädet.
// Hela kretsen är sparad som en länkad lista av CircuitNode-objekt:
//
// Den här koden är "single source of truth" för trädet. Allt som händer
// (typ drag and drop, ta bort grejer) går igenom funktionerna här så att
// resten av UI:t bara behöver lyssna på rootNode och renderVersion.

import { ref } from 'vue'
import { CircuitNode, type ElementType } from '@/utils/CircuitNode'

// Standardvärden för första parametern när man drar in ett nytt element på canvasen.
// R = 100 ohm osv.
const ELEMENT_DEFAULTS: Partial<Record<ElementType, number>> = {
  R: 100, C: 1e-6, CPE: 1e-5, W: 100, Wo: 100, Ws: 100, L: 1e-6,
}

// Standardvärde för andra parametern (för element som behöver två).
// Till exempel 'n' för CPE, eller 'tau' (tidskonstant) för Wo och Ws.
const ELEMENT_DEFAULTS2: Partial<Record<ElementType, number>> = {
  CPE: 0.85,
  Wo: 1.0,
  Ws: 1.0,
}

export function useCircuitTree() {
  // Rot-noden för kretsen. Ändrar vi den här ref:en så ritas allt om.
  // Vi startar alltid med ett R-element på 100 ohm.
  const initialRoot = new CircuitNode('R0', 'R', 100)
  const rootNode = ref<CircuitNode>(initialRoot)

  // En räknare vi plussar på varje gång strukturen ändras.
  const renderVersion = ref(0)

  // Räknare för varje typ av element så att alla får ett unikt ID (typ R0, R1, CPE0 osv).
  // Varje element har sin egen kö så ID:na alltid är logiska (W0, Wo0, L0 är separata grejer).
  const counters = { R: 1, C: 0, CPE: 0, W: 0, Wo: 0, Ws: 0, L: 0, P: 1 }

  function nextId(type: ElementType): string {
    switch (type) {
      case 'R':        return `R${counters.R++}`
      case 'C':        return `C${counters.C++}`
      case 'CPE':      return `CPE${counters.CPE++}`
      case 'W':        return `W${counters.W++}`
      case 'Wo':       return `Wo${counters.Wo++}`
      case 'Ws':       return `Ws${counters.Ws++}`
      case 'L':        return `L${counters.L++}`
      case 'parallel': return `p${counters.P++}`
      default:         return `el${counters.R++}`
    }
  }

  // Går igenom hela trädet och uppdaterar räknarna till (högsta siffran som redan finns + 1).
  // så att nya element vi lägger till inte råkar få samma ID som noder AI:t (eller en sparad fil)
  // redan har laddat in.
  function resetCounters() {
    counters.R = 0; counters.C = 0; counters.CPE = 0
    counters.W = 0; counters.Wo = 0; counters.Ws = 0
    counters.L = 0; counters.P = 0

    const visited = new Set<string>()
    function walk(node: CircuitNode | null) {
      if (!node || visited.has(node.id)) return
      visited.add(node.id)

      const match = node.id.match(/^([A-Za-z]+)(\d+)$/)
      if (match && match[1] && match[2]) {
        const prefix = match[1]
        const num    = parseInt(match[2], 10) + 1

        const key = prefix.toUpperCase() === 'P' ? 'P' : prefix as keyof typeof counters
        if (key in counters && num > counters[key]) {
          counters[key] = num
        }
      }

      if (node.upperBranch) walk(node.upperBranch)
      if (node.lowerBranch) walk(node.lowerBranch)
      if (node.next)        walk(node.next)
    }

    walk(rootNode.value)
  }

  // Loopa genom trädet
  // Samlar ihop alla noder som faktiskt har parametrar man kan ändra
  // Används av parameter-editorn och när vi kör själva fittningen.
  function collectNodes(node: CircuitNode | null, acc: CircuitNode[] = []): CircuitNode[] {
    if (!node || node.type === 'end') return acc
    if (node.type !== 'parallel') acc.push(node)
    if (node.upperBranch) collectNodes(node.upperBranch, acc)
    if (node.lowerBranch) collectNodes(node.lowerBranch, acc)
    if (node.next)        collectNodes(node.next, acc)
    return acc
  }

  // Körs när man droppar ett element på en befintlig nod på skärmen.
  function handleNodeDrop(
    targetNode: CircuitNode,
    newType: ElementType,
    action: 'before' | 'replace' | 'after',
  ) {
    const newNode = new CircuitNode(
      nextId(newType), newType,
      ELEMENT_DEFAULTS[newType] ?? 100,
      ELEMENT_DEFAULTS2[newType] ?? 1.0,
    )

    if (action === 'before') {
      newNode.setNext(targetNode)
      newNode.setEarlier(targetNode.earlier)
      if (targetNode === rootNode.value)                        rootNode.value = newNode
      else if (targetNode.earlier?.upperBranch === targetNode) targetNode.earlier.upperBranch = newNode
      else if (targetNode.earlier?.lowerBranch === targetNode) targetNode.earlier.lowerBranch = newNode
      else                                                     targetNode.earlier?.setNext(newNode)
      targetNode.setEarlier(newNode)

    } else if (action === 'replace') {
      newNode.setEarlier(targetNode.earlier)
      newNode.setNext(targetNode.next)
      if (targetNode === rootNode.value)                        rootNode.value = newNode
      else if (targetNode.earlier?.upperBranch === targetNode) targetNode.earlier.upperBranch = newNode
      else if (targetNode.earlier?.lowerBranch === targetNode) targetNode.earlier.lowerBranch = newNode
      else                                                     targetNode.earlier?.setNext(newNode)
      targetNode.next?.setEarlier(newNode)

    } else {
      const oldNext = targetNode.next
      targetNode.setNext(newNode)
      newNode.setEarlier(targetNode)
      if (oldNext) { newNode.setNext(oldNext); oldNext.setEarlier(newNode) }
    }

    renderVersion.value++
  }

  // Körs om man droppar ett element i en tom lucka i ett parallellt block (övre eller undre grenen).
  function insertIntoEmptyBranch(parentNode: CircuitNode, branch: 'upper' | 'lower', newType: string) {
    const type    = newType as ElementType
    const newNode = new CircuitNode(
      nextId(type), type,
      ELEMENT_DEFAULTS[type] ?? 100,
      ELEMENT_DEFAULTS2[type] ?? 1.0,
    )

    newNode.setEarlier(parentNode)
    if (branch === 'upper') parentNode.upperBranch = newNode
    else                    parentNode.lowerBranch = newNode
    renderVersion.value++
  }

  // Trillar in här när man klickar för att ta bort en nod.
  function deleteNode(node: CircuitNode) {
    if (node === rootNode.value) {
      // Om vi tar bort själva rot-noden: lyft upp nästa nod i kedjan så den blir root.
      // Finns ingen nästa nod skapar vi bara ett nytt standard R-element.
      const next = node.next ?? new CircuitNode('R0', 'R', 100)
      next.earlier = null
      rootNode.value = next
    } else {
      node.removeNode()
    }
    renderVersion.value++
  }

  function morphNode(node: CircuitNode, newType: ElementType) {
    // 1. Ge den ett nytt ID direkt (så t.ex. CPE0 blir W1 istället)
    node.id = nextId(newType);
    node.type = newType;

    // 2. Fixa till parametrarna så det inte kraschar
    if ((newType === 'Wo' || newType === 'Ws') && node.value2 === undefined) {
      node.value2 = 1.0; // Sätter standardvärdet för tidskonstanten till 1
    }

    renderVersion.value++;
  }

  return {
    rootNode,
    renderVersion,
    collectNodes,
    resetCounters,
    handleNodeDrop,
    insertIntoEmptyBranch,
    deleteNode,
    morphNode,
  }
}
