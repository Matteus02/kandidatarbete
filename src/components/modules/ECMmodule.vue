<script setup lang="ts">
// ECM Builder — Interactive equivalent circuit modelling for EIS data.
//
// Responsibilities of this component (the "glue"):
//   1. Owns the Plotly plots (Nyquist + Bode) and redraws them when needed.
//   2. Wires up the three sub-systems via composables and sub-components.
//   3. Watches the Pinia store for AI-suggested circuits and loads them.
//
// Logic is delegated to:
//   useCircuitTree — circuit tree state, drag-drop, node mutations
//   useLMFitting   — heuristic initialisation and Levenberg-Marquardt fitting
//   CircuitPalette — drag-and-drop element palette UI
//   ParameterEditor — parameter input grid UI

import { ref, computed, watch, onMounted, provide } from 'vue'
import Plotly from 'plotly.js-dist-min'
import BaseCard        from '@/components/ui/BaseCard.vue'
import CircuitRenderer from '@/components/circuit/CircuitRenderer.vue'
import CircuitPalette  from '@/components/circuit/CircuitPalette.vue'
import ParameterEditor from '@/components/circuit/ParameterEditor.vue'
import type { EisDataPoint } from '@/types/eis'
import type { CircuitNode }  from '@/components/circuit/CircuitNode'
import { useEisStore }       from '@/stores/eis'
import { useCircuitTree } from '@/composables/useCircuitTree'
import { useLMFitting }   from '@/composables/useLMFitting'
import { zOfChain }       from '@/utils/circuitImpedance'
import { buildTreeFromString } from '@/utils/circuitParser'

const props = defineProps<{ eisData: EisDataPoint[] }>()
const store = useEisStore()

// ── Circuit tree ─────────────────────────────────────────────────────────────
// rootNode    — the root CircuitNode (reactive; changing it triggers re-render)
// renderVersion — counter incremented on every tree change; used as SVG :key
// collectNodes  — walks the tree and returns all leaf nodes with parameters
// resetCounters — called after an AI circuit is loaded to avoid ID collisions

const {
  rootNode, renderVersion, collectNodes, resetCounters,
  handleNodeDrop, insertIntoEmptyBranch, deleteNode,
} = useCircuitTree()

// Provide drop handlers and drag state to CircuitRenderer.
// CircuitRenderer is deeply nested (it recurses into itself), so inject/provide
// is cleaner than passing the handlers as props at every level.
provide('handleNodeDrop', handleNodeDrop)
provide('insertIntoEmptyBranch', insertIntoEmptyBranch)
provide('deleteNode', deleteNode)

// Tracks whether the user is currently dragging a palette element.
// Provided to CircuitRenderer so drop zones are only visible during a drag.
const isDragging = ref(false)
provide('isDragging', isDragging)

// All leaf nodes (R, C, CPE, W …) shown in the parameter editor.
// renderVersion is read here so Vue tracks it as a dependency.
const editableNodes = computed(() => {
  renderVersion.value
  return collectNodes(rootNode.value)
})

// ── Parameter changes ────────────────────────────────────────────────────────

function onParamChange(node: CircuitNode, param: 'value' | 'value2', value: number) {
  node[param] = value
  if (showModel.value) drawPlots()   // live-update the model overlay
}

// ── Plots (Nyquist + Bode) ───────────────────────────────────────────────────

const showModel = ref(false)

function drawPlots() {
  if (props.eisData.length === 0) return

  // ── Measurement traces ───────────────────────────────────────────────────
  const measNyquist = {
    x: props.eisData.map(d => d['Re(Z)/Ohm']),
    y: props.eisData.map(d => d['-Im(Z)/Ohm']),
    mode: 'markers' as const,
    marker: { size: 6, color: '#007bff' },
    type: 'scatter' as const,
    name: 'Measurement',
  }
  const freq = props.eisData.map(d => d['freq/Hz'])

  const measBodeMag = {
    x: freq,
    y: props.eisData.map(d => d['|Z|/Ohm']),
    mode: 'lines+markers' as const,
    type: 'scatter' as const,
    name: 'Measurement',
    xaxis: 'x' as const,
    yaxis: 'y' as const,
  }
  const measBodePhase = {
    x: freq,
    y: props.eisData.map(d => d['Phase(Z)/deg']),
    mode: 'lines+markers' as const,
    type: 'scatter' as const,
    name: 'Measurement',
    showlegend: false,
    line: { color: '#007bff' },
    marker: { color: '#007bff' },
    xaxis: 'x' as const,
    yaxis: 'y2' as const,
  }

  // ── Plot layouts ─────────────────────────────────────────────────────────
  const nyqLayout = {
    title: { text: 'Nyquist Plot' },
    xaxis: { title: { text: "Z' / Ω" }, zeroline: true },
    yaxis: { title: { text: "-Z'' / Ω" }, zeroline: true, scaleanchor: 'x' as const, scaleratio: 1 },
    height: 380, margin: { t: 40, r: 20, b: 50, l: 60 }, showlegend: true,
  }
  const bodeLayout = {
    title: { text: 'Bode Plot' },
    grid: { rows: 2, columns: 1 },
    xaxis: { title: { text: 'Frequency / Hz' }, type: 'log' as const, domain: [0, 1] as [number, number] },
    yaxis: { title: { text: '|Z| / Ω' }, type: 'log' as const, domain: [0.55, 1] as [number, number] },
    yaxis2: { title: { text: 'Phase / °' }, domain: [0, 0.45] as [number, number], anchor: 'x' as const },
    height: 500, margin: { t: 50, r: 20, b: 50, l: 70 }, showlegend: true,
  }

  if (showModel.value) {
    // ── Model traces (computed from the current circuit tree) ─────────────
    const modelRe: number[] = []
    const modelIm: number[] = []
    const modelMag: number[] = []
    for (const d of props.eisData) {
      const omega = 2 * Math.PI * d['freq/Hz']
      const z     = zOfChain(rootNode.value, omega)
      modelRe.push(z.re)
      modelIm.push(-z.im)
      modelMag.push(Math.sqrt(z.re * z.re + z.im * z.im))
    }
    const modelPhase = modelRe.map((re, i) =>
      (Math.atan2(-modelIm[i]!, re) * 180) / Math.PI,
    )

    const modelNyq = { x: modelRe, y: modelIm, mode: 'lines' as const, line: { color: '#e74c3c', width: 2 }, type: 'scatter' as const, name: 'Model' }
    const modelBodeMag = { x: freq, y: modelMag, mode: 'lines' as const, line: { color: '#e74c3c', width: 2 }, type: 'scatter' as const, name: 'Model', xaxis: 'x' as const, yaxis: 'y' as const }
    const modelBodePhase = { x: freq, y: modelPhase, mode: 'lines' as const, line: { color: '#e74c3c', width: 2 }, type: 'scatter' as const, name: 'Model', showlegend: false, xaxis: 'x' as const, yaxis: 'y2' as const }

    Plotly.newPlot('ecm-nyquist', [measNyquist, modelNyq], nyqLayout)
    Plotly.newPlot('ecm-bode',   [measBodeMag, measBodePhase, modelBodeMag, modelBodePhase], bodeLayout)
  } else {
    Plotly.newPlot('ecm-nyquist', [measNyquist], nyqLayout)
    Plotly.newPlot('ecm-bode',   [measBodeMag, measBodePhase], bodeLayout)
  }
}

// ── Curve fitting ────────────────────────────────────────────────────────────

// onRedraw is called by the fitting composable after each action that
// changes node values (estimation or fitting) so the plots stay in sync.
function onRedraw() {
  renderVersion.value++
  if (showModel.value) drawPlots()
}

const { isFitting, estimateInitialValues, fitModel } = useLMFitting(
  rootNode,
  () => props.eisData,
  collectNodes,
  onRedraw,
)

// ── AI suggestion integration ────────────────────────────────────────────────

const aiAppliedCircuit = ref<string | null>(null)

// immediate: true is required because ECMmodule is wrapped in a v-if tab panel.
// When the tab becomes active the component mounts fresh, so the watcher would
// otherwise miss a store value that was already set before the mount.
watch(
  () => store.aiSuggestedCircuit,
  (circuitStr) => {
    if (!circuitStr) return
    rootNode.value     = buildTreeFromString(circuitStr)
    aiAppliedCircuit.value = circuitStr
    resetCounters()          // avoid ID collisions with user-added elements
    renderVersion.value++
  },
  { immediate: true },
)

onMounted(drawPlots)
watch(() => props.eisData, drawPlots)
</script>

<template>
  <BaseCard title="ECM Builder" @dragstart.capture="isDragging = true" @dragend.capture="isDragging = false">

    <!-- Nyquist and Bode plots -->
    <div class="plot-row">
      <div id="ecm-nyquist" class="plot" />
      <div id="ecm-bode"    class="plot" />
    </div>

    <!-- Banner shown when a circuit was loaded from the AI tab -->
    <div v-if="aiAppliedCircuit" class="ai-banner">
      AI suggestion loaded: <code>{{ aiAppliedCircuit }}</code>
    </div>

    <!-- SVG circuit canvas (key forces full re-render on every tree change) -->
    <div class="section-label">Circuit</div>
    <div class="canvas-wrap">
      <svg class="circuit-svg" width="900" height="250" style="overflow: visible" :key="renderVersion">
        <CircuitRenderer :node="rootNode" :x="50" :y="125" />
      </svg>
    </div>

    <!-- Drag-and-drop element palette + usage instructions -->
    <CircuitPalette />

    <!-- Editable parameter grid -->
    <div class="section-label" style="margin-top: 16px;">
      Parameters
      <span class="hint">(edit manually, or use the buttons below)</span>
    </div>
    <ParameterEditor :nodes="editableNodes" @change="onParamChange" />

    <!-- Action buttons -->
    <div class="plot-buttons">
      <button class="btn" :disabled="props.eisData.length === 0"
        @click="showModel = true; drawPlots()">
        Plot Circuit
      </button>
      <button class="btn btn--secondary" :disabled="props.eisData.length === 0"
        @click="estimateInitialValues">
        Estimate Initial Values
      </button>
      <button class="btn" :disabled="isFitting || props.eisData.length === 0"
        @click="fitModel">
        {{ isFitting ? 'Fitting…' : 'Fit Parameters (Auto)' }}
      </button>
    </div>

    <p v-if="props.eisData.length === 0" class="no-data-hint">
      Load EIS data in the Data tab first.
    </p>

  </BaseCard>
</template>

<style scoped>
.plot-row { display: flex; gap: 10px; justify-content: center; }
.plot     { flex: 1; min-width: 0; }

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

.circuit-svg { display: block; }

.plot-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 8px;
}

.btn {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 22px;
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn:hover:not(:disabled)           { background: #0056b3; }
.btn:disabled                       { opacity: 0.5; cursor: not-allowed; }
.btn--secondary                     { background: #6c757d; }
.btn--secondary:hover:not(:disabled){ background: #495057; }

.hint {
  font-weight: 400;
  font-size: 11px;
  color: #aaa;
  margin-left: 6px;
}

.no-data-hint { margin-top: 6px; font-size: 13px; color: #888; }

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
