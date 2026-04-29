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
import { CircuitNode, type ElementType } from '@/utils/CircuitNode'

// Default first parameter when a new element is dragged onto the canvas.
const ELEMENT_DEFAULTS: Partial<Record<ElementType, number>> = {
  R: 100, C: 1e-6, CPE: 1e-5, W: 100, Wo: 100, Ws: 100, L: 1e-6,
}

// Default second parameter for two-param elements: n for CPE, τ for Wo/Ws.
const ELEMENT_DEFAULTS2: Partial<Record<ElementType, number>> = {
  CPE: 0.85,
  Wo: 1.0,
  Ws: 1.0,
}

export function useCircuitTree() {
  // The root of the circuit tree. Changing this ref triggers a full re-render.
  const initialRoot = new CircuitNode('R0', 'R', 100)
  initialRoot.applyDefaultLimits()
  const rootNode = ref<CircuitNode>(initialRoot)

  // Incremented after every structural change so the SVG can use :key to re-render.
  const renderVersion = ref(0)

  // Per-type ID counters ensure every node has a unique label (R0, R1, CPE0 …)
  // Each element type has its own independent counter so IDs are always
  // predictable: W0, Wo0, Ws0, L0 are all separate sequences.
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

  // Scan the loaded tree and set each counter to (highest existing numeric suffix + 1)
  // so newly-added elements never collide with AI-loaded node IDs.
  function resetCounters() {
    counters.R = 0; counters.C = 0; counters.CPE = 0
    counters.W = 0; counters.Wo = 0; counters.Ws = 0
    counters.L = 0; counters.P = 0

    // We need a traversal that includes parallel nodes to reset the P counter
    const visited = new Set<string>()
    function walk(node: CircuitNode | null) {
      if (!node || visited.has(node.id)) return
      visited.add(node.id)

      const match = node.id.match(/^([A-Za-z]+)(\d+)$/)
      if (match && match[1] && match[2]) {
        const prefix = match[1]
        const num    = parseInt(match[2], 10) + 1
        
        // Handle both uppercase 'P' in counters and potential lowercase 'p' in IDs
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
    
    // Apply default physical limits
    newNode.applyDefaultLimits()

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
    
    // Apply default physical limits
    newNode.applyDefaultLimits()

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
