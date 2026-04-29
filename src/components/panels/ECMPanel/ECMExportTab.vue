<script setup lang="ts">
import { computed } from 'vue'
import type { CircuitNode } from '@/utils/CircuitNode'
import type { ModelData } from '@/composables/useCircuitModel'
import { stringifyTree } from '@/utils/circuitParser'
import { exportParametersToCSV, exportModelTraceToCSV, downloadFile, exportSvgAsPng } from '@/utils/exportUtils'
import type ECMBuilderTab from './ECMBuilderTab.vue'

const props = defineProps<{
  id: string
  rootNode: CircuitNode
  editableNodes: CircuitNode[]
  modelData: ModelData | null
  eisPlotsRef?: { downloadPlotImage: (type: 'nyquist' | 'bode') => void } | null
  builderTabRef?: InstanceType<typeof ECMBuilderTab> | null
}>()

const circuitString = computed(() => stringifyTree(props.rootNode))

function copyToClipboard() {
  navigator.clipboard.writeText(circuitString.value)
    .then(() => alert('Circuit string copied!'))
}

function handleExportParams() {
  const csv = exportParametersToCSV(props.editableNodes, circuitString.value)
  downloadFile(`${props.id}_parameters.csv`, csv)
}

function handleExportTrace() {
  if (!props.modelData) return
  const csv = exportModelTraceToCSV(props.modelData, circuitString.value)
  downloadFile(`${props.id}_model_trace.csv`, csv)
}

function handleExportCircuitImage() {
  const svg = props.builderTabRef?.svgRef as SVGGraphicsElement
  if (svg) {
    exportSvgAsPng(svg, `${props.id}_circuit_diagram`)
  }
}

function handleExportPlot(type: 'nyquist' | 'bode') {
  if (props.eisPlotsRef) {
    props.eisPlotsRef.downloadPlotImage(type)
  }
}
</script>

<template>
  <div class="ecm-export-tab">
    <div class="export-grid">

      <!-- Circuit String Group -->
      <div class="export-card full-width">
        <h4 class="card-title">Model String</h4>
        <div class="string-display">
          <code class="circuit-code">{{ circuitString }}</code>
          <button class="icon-btn" title="Copy to clipboard" @click="copyToClipboard">📋</button>
        </div>
        <p class="card-hint">Standard notation for sharing or saving your circuit structure.</p>
      </div>

      <!-- Data Exports -->
      <div class="export-card">
        <h4 class="card-title">CSV Reports</h4>
        <div class="btn-group">
          <button class="export-btn" @click="handleExportParams">
            <span class="icon"></span> Download Parameters
          </button>
          <button class="export-btn" :disabled="!modelData" @click="handleExportTrace">
            <span class="icon"></span> Download Model Trace
          </button>
        </div>
      </div>

      <!-- Image Exports -->
      <div class="export-card">
        <h4 class="card-title">Image Exports</h4>
        <div class="btn-group">
          <button class="export-btn" @click="handleExportCircuitImage">
            <span class="icon"></span> Download Circuit (PNG)
          </button>
          <button class="export-btn" :disabled="!eisPlotsRef" @click="handleExportPlot('nyquist')">
            <span class="icon"></span> Download Nyquist Plot
          </button>
          <button class="export-btn" :disabled="!eisPlotsRef" @click="handleExportPlot('bode')">
            <span class="icon"></span> Download Bode Plot
          </button>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.export-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.export-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.full-width {
  grid-column: 1 / -1;
}

.card-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  margin: 0 0 12px 0;
  letter-spacing: 0.05em;
}

.string-display {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 12px;
  margin-bottom: 8px;
}

.circuit-code {
  flex: 1;
  font-family: monospace;
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  word-break: break-all;
}

.icon-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
  border-radius: 4px;
  transition: background 0.2s;
}

.icon-btn:hover {
  background: #e2e8f0;
}

.card-hint {
  font-size: 12px;
  color: #94a3b8;
  margin: 0;
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.export-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
}

.export-btn:hover:not(:disabled) {
  background: #f1f5f9;
  border-color: #007bff;
  color: #007bff;
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f8fafc;
}

.icon {
  font-size: 16px;
}
</style>
