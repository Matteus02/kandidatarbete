// Converts an AI circuit string into a CircuitNode tree.
//
// Circuit string format (from the AI model's KNOWN_CIRCUITS):
//   - Series elements are joined by "-":   R0-p(R1,CPE0)-W0
//   - Parallel blocks use p(upper, lower): p(R1,CPE0)
//   - Element IDs start with the element type letter: R, C, CPE, Wo, Ws, W, L
//
// Example:  "R0-p(R1,CPE0)-W0"
//   → R0 (series)  →  parallel(R1, CPE0)  →  W0 (series)

import { CircuitNode, type ElementType } from '@/utils/CircuitNode'

type ElementInfo = { type: ElementType; value: number; value2?: number }

// Maps an element ID string to its type and default parameter value.
// Order matters: CPE and Wo/Ws must be checked before W and C to avoid partial matches.
function parseElementInfo(id: string): ElementInfo | null {
  const s = id.trim()
  if (s.startsWith('CPE')) return { type: 'CPE', value: 1e-5, value2: 0.85 }
  if (s.startsWith('Wo'))  return { type: 'Wo',  value: 100, value2: 1.0 }
  if (s.startsWith('Ws'))  return { type: 'Ws',  value: 100, value2: 1.0 }
  if (s.startsWith('W'))   return { type: 'W',   value: 100 }
  if (s.startsWith('R'))   return { type: 'R',   value: 100 }
  if (s.startsWith('C'))   return { type: 'C',   value: 1e-6 }
  if (s.startsWith('L'))   return { type: 'L',   value: 1e-6 }
  return null
}

// Splits a circuit string at "-" separators that are at the top level only
// (not inside parentheses). This correctly handles nested parallel blocks.
//
// Example: "R0-p(R1,CPE0)-W0" → ["R0", "p(R1,CPE0)", "W0"]
function splitSeriesTopLevel(str: string): string[] {
  const parts: string[] = []
  let depth = 0
  let current = ''
  for (const ch of str) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === '-' && depth === 0) {
      if (current) parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current) parts.push(current)
  return parts
}

// Builds a CircuitNode linked-list tree from a circuit string.
// Returns the root node of the resulting series chain.
// Falls back to a single R0 = 100 Ω node if the string cannot be parsed.
export function buildTreeFromString(circuitString: string): CircuitNode {
  const elements = splitSeriesTopLevel(circuitString)
  const nodes: CircuitNode[] = []
  let parallelIndex = 0

  for (const elem of elements) {
    const e = elem.trim()

    if (e.startsWith('p(') && e.endsWith(')')) {
      // ── Parallel block: p(upper, lower) ───────────────────────────────
      const inner    = e.slice(2, -1)
      const comma    = inner.indexOf(',')
      const upperStr = comma >= 0 ? inner.slice(0, comma) : inner
      const lowerStr = comma >= 0 ? inner.slice(comma + 1) : ''

      const pNode = new CircuitNode(`p${parallelIndex++}`, 'parallel', 0)
      pNode.applyDefaultLimits()

      const uInfo = parseElementInfo(upperStr)
      if (uInfo) {
        const u = new CircuitNode(upperStr.trim(), uInfo.type, uInfo.value, uInfo.value2 ?? 1.0)
        u.applyDefaultLimits()
        u.setEarlier(pNode)
        pNode.upperBranch = u
      }

      const lInfo = lowerStr ? parseElementInfo(lowerStr) : null
      if (lInfo) {
        const l = new CircuitNode(lowerStr.trim(), lInfo.type, lInfo.value, lInfo.value2 ?? 1.0)
        l.applyDefaultLimits()
        l.setEarlier(pNode)
        pNode.lowerBranch = l
      }

      nodes.push(pNode)
    } else {
      // ── Series element ─────────────────────────────────────────────────
      const info = parseElementInfo(e)
      if (info) {
        const node = new CircuitNode(e, info.type, info.value, info.value2 ?? 1.0)
        node.applyDefaultLimits()
        nodes.push(node)
      }
    }
  }

  // Link all nodes into a series chain via .next / .earlier pointers
  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i]!.setNext(nodes[i + 1]!)
    nodes[i + 1]!.setEarlier(nodes[i]!)
  }

  const finalRoot = nodes[0] ?? new CircuitNode('R0', 'R', 100)
  finalRoot.applyDefaultLimits()
  return finalRoot
}

/**
 * Converts a CircuitNode tree back into its string representation.
 * Handles nested parallel blocks and series chains.
 */
export function stringifyTree(root: CircuitNode | null): string {
  if (!root) return ''
  const parts: string[] = []
  let current: CircuitNode | null = root

  while (current) {
    if (current.type === 'end') break

    if (current.type === 'parallel') {
      const upper = stringifyTree(current.upperBranch)
      const lower = stringifyTree(current.lowerBranch)
      parts.push(`p(${upper},${lower})`)
    } else if (current.type !== 'empty') {
      parts.push(current.id)
    }

    current = current.next
  }

  return parts.join('-')
}
