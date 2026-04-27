<script setup lang="ts">
import { ref } from 'vue'
import type { CircuitNode } from '@/components/circuit/CircuitNode'
import CircuitRenderer from '@/components/circuit/CircuitRenderer.vue'
import CircuitPalette  from '@/components/circuit/CircuitPalette.vue'

const props = defineProps<{
  rootNode: CircuitNode
  renderVersion: number
  aiAppliedCircuit: string | null
}>()

const svgRef = ref<SVGGraphicsElement | null>(null)

defineExpose({
  svgRef
})
</script>

<template>
  <div class="ecm-builder-tab">
    <!-- Banner shown when a circuit was loaded from the AI tab -->
    <div v-if="aiAppliedCircuit" class="ai-banner">
      AI suggestion loaded: <code>{{ aiAppliedCircuit }}</code>
    </div>

    <!-- SVG circuit canvas (key forces full re-render on every tree change) -->
    <div class="section-label">Circuit</div>
    <div class="canvas-wrap">
      <svg ref="svgRef" class="circuit-svg" width="900" height="250" style="overflow: visible" :key="renderVersion">
        <!-- Start Terminal Symbol -->
        <g transform="translate(15, 125)">
          <circle cx="0" cy="0" r="4" fill="white" stroke="#333" stroke-width="2" />
          <line x1="4" y1="0" x2="35" y2="0" stroke="#333" stroke-width="2" />
        </g>
        <CircuitRenderer :node="rootNode" :x="50" :y="125" />
      </svg>
    </div>

    <!-- Drag-and-drop element palette + usage instructions -->
    <CircuitPalette />
  </div>
</template>

<style scoped>
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
