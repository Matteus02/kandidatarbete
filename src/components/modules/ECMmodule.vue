<script setup lang="ts">
import { ref, computed, watch, onMounted, provide } from 'vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { EisDataPoint } from '@/types/eis'
import { CircuitNode, type ElementType } from '@/components/circuit/CircuitNode'
import CircuitRenderer from '@/components/circuit/CircuitRenderer.vue'
import ResistorSymbol from '@/components/circuit/ResistorSymbol.vue'
import CapacitorSymbol from '@/components/circuit/CapacitorSymbol.vue'
import CpeSymbol from '@/components/circuit/CpeSymbol.vue'
import WarburgSymbol from '@/components/circuit/WarburgSymbol.vue'
import ParallellSymbol from '@/components/circuit/ParallellSymbol.vue'
import Plotly from 'plotly.js-dist-min'
import { add, parallel, zR, zC, zCPE, zW } from '@/utils/impedance'
import type { Complex } from '@/utils/impedance'
import { useEisStore } from '@/stores/eis'
import * as fmin from 'fmin'

const props = defineProps<{ eisData: EisDataPoint[] }>()
const store = useEisStore()

// CPE exponent fixed at 0.85 — adjust here if needed
const CPE_N = 0.85

const ELEMENT_DEFAULTS: Partial<Record<ElementType, number>> = {
  R: 100,
  C: 1e-6,
  CPE: 1e-5,
  W: 100,
}

const ELEMENT_UNITS: Partial<Record<ElementType, string>> = {
  R: 'Ω',
  C: 'F',
  CPE: `Q (n=${CPE_N})`,
  W: 'Ω·s⁻⁰·⁵',
}

// ─── Circuit state ─────────────────────────────────────────────────────────

const rootNode = ref<CircuitNode>(new CircuitNode('R0', 'R', 100))
const renderVersion = ref(0)

const RIdCounter = ref(1)
const CIdCounter = ref(0)
const CPEIdCounter = ref(0)
const WIdCounter = ref(0)
const PIdCounter = ref(1)

function nextId(type: ElementType): string {
  switch (type) {
    case 'R':        return `R${RIdCounter.value++}`
    case 'C':        return `C${CIdCounter.value++}`
    case 'CPE':      return `CPE${CPEIdCounter.value++}`
    case 'W':        return `W${WIdCounter.value++}`
    case 'parallel': return `p${PIdCounter.value++}`
    default:         return `el${RIdCounter.value++}`
  }
}

// ─── Drag & Drop (provide to CircuitRenderer) ──────────────────────────────

const handleDragStart = (event: DragEvent, type: ElementType) => {
  if (event.dataTransfer) {
    event.dataTransfer.setData('componentType', type)
    event.dataTransfer.effectAllowed = 'copy'
  }
}

const handleNodeDrop = (
  targetNode: CircuitNode,
  newType: ElementType,
  action: 'before' | 'replace' | 'after',
) => {
  const defVal = ELEMENT_DEFAULTS[newType] ?? 100
  const newNode = new CircuitNode(nextId(newType), newType, defVal)

  if (action === 'before') {
    newNode.setNext(targetNode)
    newNode.setEarlier(targetNode.earlier)
    if (targetNode === rootNode.value) rootNode.value = newNode
    else if (targetNode.earlier?.upperBranch === targetNode) targetNode.earlier.upperBranch = newNode
    else if (targetNode.earlier?.lowerBranch === targetNode) targetNode.earlier.lowerBranch = newNode
    else targetNode.earlier?.setNext(newNode)
    targetNode.setEarlier(newNode)
  } else if (action === 'replace') {
    newNode.setEarlier(targetNode.earlier)
    newNode.setNext(targetNode.next)
    if (targetNode === rootNode.value) rootNode.value = newNode
    else if (targetNode.earlier?.upperBranch === targetNode) targetNode.earlier.upperBranch = newNode
    else if (targetNode.earlier?.lowerBranch === targetNode) targetNode.earlier.lowerBranch = newNode
    else targetNode.earlier?.setNext(newNode)
    targetNode.next?.setEarlier(newNode)
  } else {
    const oldNext = targetNode.next
    targetNode.setNext(newNode)
    newNode.setEarlier(targetNode)
    if (oldNext) { newNode.setNext(oldNext); oldNext.setEarlier(newNode) }
  }

  renderVersion.value++
}

const insertIntoEmptyBranch = (
  parentNode: CircuitNode,
  branch: 'upper' | 'lower',
  newType: string,
) => {
  const type = newType as ElementType
  const newNode = new CircuitNode(nextId(type), type, ELEMENT_DEFAULTS[type] ?? 100)
  newNode.setEarlier(parentNode)
  if (branch === 'upper') parentNode.upperBranch = newNode
  else parentNode.lowerBranch = newNode
  renderVersion.value++
}

const deleteNode = (node: CircuitNode) => {
  if (node === rootNode.value) {
    const next = node.next ?? new CircuitNode('R0', 'R', 100)
    next.earlier = null
    rootNode.value = next
  } else {
    node.removeNode()
  }
  renderVersion.value++
}

provide('handleNodeDrop', handleNodeDrop)
provide('insertIntoEmptyBranch', insertIntoEmptyBranch)
provide('deleteNode', deleteNode)

// ─── Parameter editor ──────────────────────────────────────────────────────

function collectNodes(node: CircuitNode | null, acc: CircuitNode[] = []): CircuitNode[] {
  if (!node || node.type === 'end') return acc
  if (node.type !== 'parallel') acc.push(node)
  if (node.upperBranch) collectNodes(node.upperBranch, acc)
  if (node.lowerBranch) collectNodes(node.lowerBranch, acc)
  if (node.next) collectNodes(node.next, acc)
  return acc
}

const editableNodes = computed(() => {
  renderVersion.value // reactive dependency on tree changes
  return collectNodes(rootNode.value)
})

function onParamInput(node: CircuitNode, val: string) {
  const parsed = parseFloat(val)
  if (!isNaN(parsed)) {
    node.value = parsed
    // Re-plot if model is already shown
    if (showModel.value) drawPlots()
  }
}

// ─── Impedance from tree ───────────────────────────────────────────────────

function zOfNode(node: CircuitNode, omega: number): Complex {
  switch (node.type) {
    case 'R':        return zR(node.value)
    case 'C':        return zC(node.value, omega)
    case 'CPE':      return zCPE(node.value, CPE_N, omega)
    case 'W':        return zW(node.value, omega)
    case 'parallel': {
      const zu = node.upperBranch ? zOfChain(node.upperBranch, omega) : null
      const zl = node.lowerBranch ? zOfChain(node.lowerBranch, omega) : null
      if (zu && zl) return parallel(zu, zl)
      return zu ?? zl ?? { re: 0, im: 0 }
    }
    default: return { re: 0, im: 0 }
  }
}

function zOfChain(node: CircuitNode | null, omega: number): Complex {
  if (!node || node.type === 'end') return { re: 0, im: 0 }
  return add(zOfNode(node, omega), zOfChain(node.next, omega))
}
// ─── Curve Fitting (CNLS) ──────────────────────────────────────────────────

const isFitting = ref(false)

const fitModel = () => {
  if (props.eisData.length === 0) {
    alert("Ingen mätdata att anpassa mot!")
    return
  }

  isFitting.value = true

  // 1. Samla alla noder som har ett parametervärde (R, C, CPE, W)
  const nodes = collectNodes(rootNode.value)
  const optimizableNodes = nodes.filter(n => ['R', 'C', 'CPE', 'W'].includes(n.type))

  if (optimizableNodes.length === 0) {
    isFitting.value = false
    return
  }

  // Spara undan startvärdena
  const initialValues = optimizableNodes.map(n => n.value)

  // 2. Definiera kostnadsfunktionen (Cost Function)
const calculateError = (params: number[]) => {
    optimizableNodes.forEach((node, idx) => {
      const val = params[idx] ?? 0
      node.value = Math.max(1e-15, Math.abs(val))
    })

    let totalError = 0
    // ... resten av koden är samma

    // Beräkna felet för varje frekvenspunkt
    for (const d of props.eisData) {
      const omega = 2 * Math.PI * d['freq/Hz']

      const measRe = d['Re(Z)/Ohm']
      const measIm = d['-Im(Z)/Ohm']

      const modelZ = zOfChain(rootNode.value, omega)

      const reError = measRe - modelZ.re
      const imError = measIm - (-modelZ.im)

      // Viktning: Dela felet med |Z|^2 (Modulus weighting)
      const magSq = (measRe * measRe) + (measIm * measIm) || 1e-10

      totalError += (reError * reError + imError * imError) / magSq
    }

    return totalError
  }

  // 3. Kör optimeringen med Nelder-Mead
  try {
    const solution = fmin.nelderMead(calculateError, initialValues)

    // 4. Sätt de slutgiltiga, optimerade värdena i kretsen
    optimizableNodes.forEach((node, idx) => {
      node.value = Math.max(1e-15, Math.abs(solution.x[idx]))
    })

  renderVersion.value++
  if (showModel.value){drawPlots()}

  } catch (err) {
    console.error("Optimeringen misslyckades:", err)
    alert("Kunde inte anpassa kurvan. Testa att ge kretsen bättre startvärden.")
  } finally {
    isFitting.value = false
  }
}
// ─── Plots ─────────────────────────────────────────────────────────────────

const showModel = ref(false)

const drawPlots = () => {
  if (props.eisData.length === 0) return

  const zReal = props.eisData.map((d) => d['Re(Z)/Ohm'])
  const zImag = props.eisData.map((d) => d['-Im(Z)/Ohm'])
  const freq  = props.eisData.map((d) => d['freq/Hz'])
  const zMag  = props.eisData.map((d) => d['|Z|/Ohm'])

  const measNyquist = {
    x: zReal, y: zImag,
    mode: 'markers' as const,
    marker: { size: 6, color: '#007bff' },
    type: 'scatter' as const,
    name: 'Measurement',
  }
  const measBode = {
    x: freq, y: zMag,
    mode: 'lines+markers' as const,
    type: 'scatter' as const,
    name: 'Measurement',
  }

  const nyqLayout = {
    title: { text: 'Nyquist Plot' },
    xaxis: { title: { text: "Z' / Ω" }, zeroline: true },
    yaxis: { title: { text: "-Z'' / Ω" }, zeroline: true, scaleanchor: 'x' as const, scaleratio: 1 },
    height: 380, margin: { t: 40, r: 20, b: 50, l: 60 },
    showlegend: true,
  }
  const bodeLayout = {
    title: { text: 'Bode Plot (Magnitude)' },
    xaxis: { title: { text: 'Frequency / Hz' }, type: 'log' as const },
    yaxis: { title: { text: '|Z| / Ω' }, type: 'log' as const },
    height: 380, margin: { t: 40, r: 20, b: 50, l: 60 },
    showlegend: true,
  }

  if (showModel.value) {
    const modelRe: number[] = []
    const modelIm: number[] = []
    const modelMag: number[] = []

    for (const d of props.eisData) {
      const omega = 2 * Math.PI * d['freq/Hz']
      const z = zOfChain(rootNode.value, omega)
      modelRe.push(z.re)
      modelIm.push(-z.im)
      modelMag.push(Math.sqrt(z.re * z.re + z.im * z.im))
    }

    const modelNyq = {
      x: modelRe, y: modelIm,
      mode: 'lines' as const,
      line: { color: '#e74c3c', width: 2 },
      type: 'scatter' as const,
      name: 'Model',
    }
    const modelBode = {
      x: freq, y: modelMag,
      mode: 'lines' as const,
      line: { color: '#e74c3c', width: 2 },
      type: 'scatter' as const,
      name: 'Model',
    }

    Plotly.newPlot('ecm-nyquist', [measNyquist, modelNyq], nyqLayout)
    Plotly.newPlot('ecm-bode', [measBode, modelBode], bodeLayout)
  } else {
    Plotly.newPlot('ecm-nyquist', [measNyquist], nyqLayout)
    Plotly.newPlot('ecm-bode', [measBode], bodeLayout)
  }
}

const plotWithCircuit = () => {
  showModel.value = true
  drawPlots()
}

// ─── Circuit string parser (AI → tree) ────────────────────────────────────

function parseElementInfo(id: string): { type: ElementType; value: number } | null {
  const s = id.trim()
  if (s.startsWith('CPE')) return { type: 'CPE', value: 1e-5 }
  if (s.startsWith('Wo') || s.startsWith('Ws')) return { type: 'W', value: 100 }
  if (s.startsWith('W')) return { type: 'W', value: 100 }
  if (s.startsWith('R')) return { type: 'R', value: 100 }
  if (s.startsWith('C')) return { type: 'C', value: 1e-6 }
  if (s.startsWith('L')) return { type: 'R', value: 1e-7 } // inductor → tiny R
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

function buildTreeFromString(circuitString: string): CircuitNode {
  const elems = splitSeriesTopLevel(circuitString)
  const nodes: CircuitNode[] = []
  let pIdx = 0

  for (const elem of elems) {
    const e = elem.trim()
    if (e.startsWith('p(') && e.endsWith(')')) {
      const inner = e.slice(2, -1)
      const comma = inner.indexOf(',')
      const upperStr = comma >= 0 ? inner.slice(0, comma) : inner
      const lowerStr = comma >= 0 ? inner.slice(comma + 1) : ''

      const pNode = new CircuitNode(`p${pIdx++}`, 'parallel', 0)

      const uInfo = parseElementInfo(upperStr)
      if (uInfo) {
        const u = new CircuitNode(upperStr.trim(), uInfo.type, uInfo.value)
        u.setEarlier(pNode)
        pNode.upperBranch = u
      }
      const lInfo = lowerStr ? parseElementInfo(lowerStr) : null
      if (lInfo) {
        const l = new CircuitNode(lowerStr.trim(), lInfo.type, lInfo.value)
        l.setEarlier(pNode)
        pNode.lowerBranch = l
      }
      nodes.push(pNode)
    } else {
      const info = parseElementInfo(e)
      if (info) nodes.push(new CircuitNode(e, info.type, info.value))
    }
  }

  for (let i = 0; i < nodes.length - 1; i++) {
    nodes[i]!.setNext(nodes[i + 1]!)
    nodes[i + 1]!.setEarlier(nodes[i]!)
  }

  return nodes[0] ?? new CircuitNode('R0', 'R', 100)
}

// Apply AI suggestion: parse circuit string into tree and show AI banner
const aiAppliedCircuit = ref<string | null>(null)

watch(
  () => store.aiSuggestedCircuit,
  (circuitStr) => {
    if (!circuitStr) return
    rootNode.value = buildTreeFromString(circuitStr)
    aiAppliedCircuit.value = circuitStr
    RIdCounter.value = 20
    CIdCounter.value = 20
    CPEIdCounter.value = 20
    WIdCounter.value = 20
    PIdCounter.value = 20
    renderVersion.value++
  },
  { immediate: true },
)

onMounted(drawPlots)
watch(() => props.eisData, drawPlots)
</script>

<template>
  <BaseCard title="ECM Builder">

    <!-- Plots -->
    <div class="plot-row">
      <div id="ecm-nyquist" class="plot"></div>
      <div id="ecm-bode"    class="plot"></div>
    </div>
    <br>
    <!-- AI suggestion banner -->
    <div v-if="aiAppliedCircuit" class="ai-banner">
      AI suggestion loaded: <code>{{ aiAppliedCircuit }}</code>
    </div>

    <!-- Circuit canvas -->
    <div class="section-label">Circuit</div>
    <div class="canvas-wrap">
      <svg
        class="circuit-svg"
        width="900"
        height="250"
        style="overflow: visible"
        :key="renderVersion"
      >
        <CircuitRenderer v-if="rootNode" :node="rootNode" :x="50" :y="125" />
      </svg>
    </div>

    <!-- Component palette -->
    <div class="palette">
      <div
        v-for="item in [
          { type: 'R',        label: 'Resistor' },
          { type: 'C',        label: 'Capacitor' },
          { type: 'CPE',      label: 'CPE' },
          { type: 'W',        label: 'Warburg' },
          { type: 'parallel', label: 'Parallel' },
        ]"
        :key="item.type"
        class="palette-item"
        draggable="true"
        @dragstart="handleDragStart($event, item.type as ElementType)"
      >
        <svg width="100" height="46" style="overflow: visible; pointer-events: none">
          <g :transform="`translate(20, 23)`">
            <ResistorSymbol v-if="item.type === 'R'"   label="" />
            <CapacitorSymbol v-else-if="item.type === 'C'"  label="" />
            <CpeSymbol       v-else-if="item.type === 'CPE'"  label="" />
            <WarburgSymbol   v-else-if="item.type === 'W'"  label="" />
            <ParallellSymbol v-else-if="item.type === 'parallel'" />
          </g>
        </svg>
        <span class="palette-label">{{ item.label }}</span>
      </div>
      <div class = "instruction">
        <p>Start Building: Drag a component (Resistor, Capacitor, etc.) from the menu and drop it onto the empty dashed box.</p>
        <p> Add in Series: Drag a new component and drop it onto the + icons to place it either before or after an existing part.</p>
        <p>Create Parallel Branches: Drag a Parallel Block to the board, then drop components directly into the empty "drop here" zones inside it.</p>
        <p>Replace a Component: Drop a new component directly on top of an existing one to swap them out instantly.</p>
        <p>Delete: Simply click on any component on the board to remove it.</p>
      </div>
    </div>
    <br>
    <!-- Parameter editor -->
    <div class="section-label" style="margin-top: 16px;">Parameters <span class="hint">(Adjust Parameters by changing values below)</span></div>
    <div class="param-grid">
      <div
        v-for="node in editableNodes"
        :key="node.id"
        class="param-item"
      >
        <label class="param-label">
          {{ node.id }}
          <span class="param-unit">{{ ELEMENT_UNITS[node.type as ElementType] ?? '' }}</span>
        </label>
        <input
          class="param-input"
          type="number"
          :value="node.value"
          step="any"
          @change="(e) => onParamInput(node, (e.target as HTMLInputElement).value)"
        />
      </div>
    </div>

    <!-- Action button -->
     <div class="plot-buttons">
      <button class="plot-btn" :disabled="props.eisData.length === 0" @click="plotWithCircuit">
        Plot Circuit
      </button>

      <button
      @click="fitModel"
      :disabled="isFitting || props.eisData.length === 0"
       class="plot-btn">
      {{ isFitting ? 'Anpassar...' : 'Fit Parameters to Circuit (Auto)' }}
      </button>
    </div>
    <p v-if="props.eisData.length === 0" class="no-data-hint">
      Load EIS data in the Data tab first.
    </p>

  </BaseCard>
</template>

<style scoped>
.plot-row {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.plot {
  flex: 1;
  min-width: 0;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
  margin: 14px 0 6px;
}

.canvas-wrap {
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fafafa;
  overflow-x: auto;
  padding: 8px 0;
}

.circuit-svg {
  display: block;
}

.palette {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.instruction {
  font-size:10px;
  color: black;
  max-width: 600px;

}

.palette-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f8f8f8;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 4px 8px;
  cursor: grab;
  user-select: none;
  -webkit-user-select: none;
  transition: background-color 0.15s;
}

.palette-item:hover {
  background: #eef4ff;
  border-color: #007bff;
}

.palette-label {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

.param-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 14px;
}
.plot-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px; /* Adjust this value as needed */
}
.param-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 130px;
}

.param-label {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.param-unit {
  font-weight: 400;
  color: #888;
  margin-left: 4px;
}

.param-input {
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 13px;
  width: 100%;
}

.param-input:focus {
  outline: none;
  border-color: #007bff;
}

.hint {
  font-weight: 400;
  font-size: 11px;
  color: #aaa;
  margin-left: 6px;
}

.plot-btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 22px;
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.plot-btn:hover:not(:disabled) {
  background: #0056b3;
}

.plot-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.no-data-hint {
  margin-top: 6px;
  font-size: 13px;
  color: #888;
}

.ai-banner {
  padding: 8px 12px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 4px;
  font-size: 13px;
  color: #1e40af;
  margin-bottom: 10px;
}
</style>
