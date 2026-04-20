// Vue composable that owns all circuit tree state and mutations.
//
// The circuit is stored as a linked-list tree of CircuitNode objects:
//   - .next / .earlier  link nodes in series
//   - .upperBranch / .lowerBranch  define the two arms of a parallel block
//
// This composable is the single source of truth for the tree. All structural
// changes (drag-drop, delete) go through its functions so the rest of the UI
// only needs to react to rootNode and renderVersion.

import { ref } from 'vue'
import { CircuitNode, type ElementType } from '@/components/circuit/CircuitNode'

// Default first parameter when a new element is dragged onto the canvas.
const ELEMENT_DEFAULTS: Partial<Record<ElementType, number>> = {
  R: 100, C: 1e-6, CPE: 1e-5, W: 100, Wo: 100, Ws: 100, L: 1e-6,
}

// Default second parameter (τ) for the two-parameter Warburg elements.
const ELEMENT_DEFAULTS2: Partial<Record<ElementType, number>> = {
  Wo: 1.0,
  Ws: 1.0,
}

export function useCircuitTree() {
  // The root of the circuit tree. Changing this ref triggers a full re-render.
  const rootNode = ref<CircuitNode>(new CircuitNode('R0', 'R', 100))

  // Incremented after every structural change so the SVG can use :key to re-render.
  const renderVersion = ref(0)

  // Per-type ID counters ensure every node has a unique label (R0, R1, CPE0 …)
  const counters = { R: 1, C: 0, CPE: 0, W: 0, P: 1 }

  function nextId(type: ElementType): string {
    switch (type) {
      case 'R':        return `R${counters.R++}`
      case 'C':        return `C${counters.C++}`
      case 'CPE':      return `CPE${counters.CPE++}`
      case 'W':        return `W${counters.W++}`
      case 'Wo':       return `Wo${counters.W++}`
      case 'Ws':       return `Ws${counters.W++}`
      case 'L':        return `L${counters.C++}`
      case 'parallel': return `p${counters.P++}`
      default:         return `el${counters.R++}`
    }
  }

  // Set all counters to 20 so elements added after an AI-loaded circuit
  // don't produce IDs that collide with the loaded element names.
  function resetCounters() {
    counters.R = 20; counters.C = 20; counters.CPE = 20
    counters.W = 20; counters.P = 20
  }

  // ── Tree traversal ────────────────────────────────────────────────────────

  // Returns all nodes that have editable parameters (skips 'parallel' and 'end').
  // Used by the parameter editor and the fitting algorithm.
  function collectNodes(node: CircuitNode | null, acc: CircuitNode[] = []): CircuitNode[] {
    if (!node || node.type === 'end') return acc
    if (node.type !== 'parallel') acc.push(node)
    if (node.upperBranch) collectNodes(node.upperBranch, acc)
    if (node.lowerBranch) collectNodes(node.lowerBranch, acc)
    if (node.next)        collectNodes(node.next, acc)
    return acc
  }

  // ── Tree mutations ────────────────────────────────────────────────────────

  // Called when the user drops an element onto an existing node.
  // action:
  //   'before'  — insert the new node immediately before the target
  //   'replace' — swap the target node out for the new one
  //   'after'   — insert the new node immediately after the target
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

    } else { // 'after'
      const oldNext = targetNode.next
      targetNode.setNext(newNode)
      newNode.setEarlier(targetNode)
      if (oldNext) { newNode.setNext(oldNext); oldNext.setEarlier(newNode) }
    }

    renderVersion.value++
  }

  // Called when the user drops an element into an empty branch slot of a parallel node.
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

  // Called when the user clicks a node to remove it from the tree.
  function deleteNode(node: CircuitNode) {
    if (node === rootNode.value) {
      // Deleting the root: promote the next node (or reset to a single R)
      const next = node.next ?? new CircuitNode('R0', 'R', 100)
      next.earlier = null
      rootNode.value = next
    } else {
      node.removeNode()
    }
    renderVersion.value++
  }

  return {
    rootNode,
    renderVersion,
    collectNodes,
    resetCounters,
    handleNodeDrop,
    insertIntoEmptyBranch,
    deleteNode,
  }
}
