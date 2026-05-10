import { CircuitNode, type ElementType } from '@/utils/CircuitNode'

type ElementInfo = { type: ElementType; value: number; value2?: number }

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

function findTopLevelComma(str: string): number {
  let depth = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '(') depth++
    else if (str[i] === ')') depth--
    else if (str[i] === ',' && depth === 0) return i
  }
  return -1
}

function buildTreeInternal(circuitString: string, pCounter: { n: number }): CircuitNode {
  const elements = splitSeriesTopLevel(circuitString.trim())
  const nodes: CircuitNode[] = []

  for (const elem of elements) {
    const e = elem.trim()

    if (e.startsWith('p(') && e.endsWith(')')) {
      const inner    = e.slice(2, -1)
      const comma    = findTopLevelComma(inner)
      const upperStr = comma >= 0 ? inner.slice(0, comma).trim() : inner.trim()
      const lowerStr = comma >= 0 ? inner.slice(comma + 1).trim() : ''

      const pNode = new CircuitNode(`p${pCounter.n++}`, 'parallel', 0)

      const u = buildTreeInternal(upperStr, pCounter)
      u.setEarlier(pNode)
      pNode.upperBranch = u

      if (lowerStr) {
        const l = buildTreeInternal(lowerStr, pCounter)
        l.setEarlier(pNode)
        pNode.lowerBranch = l
      }

      nodes.push(pNode)
    } else {
      const info = parseElementInfo(e)
      if (info) {
        const node = new CircuitNode(e, info.type, info.value, info.value2 ?? 1.0)
        nodes.push(node)
      }
    }
  }

  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i]!.setNext(nodes[i + 1]!)
    nodes[i + 1]!.setEarlier(nodes[i]!)
  }

  const finalRoot = nodes[0] ?? new CircuitNode('R0', 'R', 100)
  return finalRoot
}

export function buildTreeFromString(circuitString: string): CircuitNode {
  return buildTreeInternal(circuitString, { n: 0 })
}

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
    } else {
      parts.push(current.id)
    }

    current = current.next
  }

  return parts.join('-')
}
