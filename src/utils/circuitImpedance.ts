// Calculates the complex impedance Z(ω) of a CircuitNode tree.
//
// The circuit is stored as a linked list of nodes (series chain) where each
// node can also have two child branches (parallel block). These two functions
// mirror that structure directly:
//
//   zOfNode  — computes Z for a single node (element or parallel block)
//   zOfChain — sums impedances along a series chain by following .next pointers

import type { CircuitNode } from '@/components/circuit/CircuitNode'
import { type Complex, add, parallel, zR, zC, zCPE, zW, zL, zWo, zWs } from '@/utils/impedance'

// The CPE exponent n is fixed here. Changing it to a free parameter would
// require adding it to the CircuitNode and exposing it in the parameter editor.
export const CPE_N = 0.85

// Compute Z for a single node at angular frequency ω.
export function zOfNode(node: CircuitNode, omega: number): Complex {
  switch (node.type) {
    case 'R':   return zR(node.value)
    case 'C':   return zC(node.value, omega)
    case 'CPE': return zCPE(node.value, CPE_N, omega)
    case 'W':   return zW(node.value, omega)
    case 'L':   return zL(node.value, omega)
    case 'Wo':  return zWo(node.value, node.value2, omega)
    case 'Ws':  return zWs(node.value, node.value2, omega)

    case 'parallel': {
      // Combine the two branch impedances in parallel.
      // If only one branch is populated, use that branch's impedance directly.
      const zu = node.upperBranch ? zOfChain(node.upperBranch, omega) : null
      const zl = node.lowerBranch ? zOfChain(node.lowerBranch, omega) : null
      if (zu && zl) return parallel(zu, zl)
      return zu ?? zl ?? { re: 0, im: 0 }
    }

    default: return { re: 0, im: 0 }
  }
}

// Compute the total series impedance of a chain starting at `node`.
// Recursively follows .next until it reaches null or an 'end' node.
export function zOfChain(node: CircuitNode | null, omega: number): Complex {
  if (!node || node.type === 'end') return { re: 0, im: 0 }
  return add(zOfNode(node, omega), zOfChain(node.next, omega))
}
