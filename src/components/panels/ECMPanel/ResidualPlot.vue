<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import Plotly from 'plotly.js-dist-min'
import BaseCard from '@/components/ui/BaseCard.vue'

const props = defineProps<{
  frequencies: number[]
  residualsRe: number[]
  residualsIm: number[]
}>()

const plotRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const drawPlot = () => {
  if (!plotRef.value || props.frequencies.length === 0) return

  const traceRe = {
    x: props.frequencies,
    y: props.residualsRe,
    mode: 'markers' as const,
    type: 'scatter' as const,
    name: "Z' Residual",
    marker: { color: '#3b82f6', size: 6 }
  }

  const traceIm = {
    x: props.frequencies,
    y: props.residualsIm,
    mode: 'markers' as const,
    type: 'scatter' as const,
    name: 'Z" Residual',
    marker: { color: '#f59e0b', size: 6 }
  }

  const layout = {
    title: { text: 'Residual Analysis', font: { size: 14 } },
    xaxis: {
      title: { text: 'Frequency / Hz' },
      type: 'log' as const,
      gridcolor: '#f1f5f9'
    },
    yaxis: {
      title: { text: 'Residual Error / %' },
      gridcolor: '#f1f5f9',
      zeroline: true,
      zerolinecolor: '#94a3b8',
      zerolinedash: 'dash' as const
    },
    margin: { t: 40, r: 20, b: 40, l: 50 },
    height: 350,
    autosize: true,
    showlegend: true,
    legend: { orientation: 'h' as const, y: -0.2 },
    hovermode: 'closest' as const,
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)'
  }

  Plotly.react(plotRef.value, [traceRe, traceIm], layout, { responsive: true, displayModeBar: false })
}

onMounted(() => {
  drawPlot()
  
  if (plotRef.value) {
    resizeObserver = new ResizeObserver(() => {
      if (plotRef.value) {
        Plotly.Plots.resize(plotRef.value)
      }
    })
    resizeObserver.observe(plotRef.value)
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})

watch(() => [props.frequencies, props.residualsRe, props.residualsIm], drawPlot, { deep: true })
</script>

<template>
  <BaseCard title="Residual Distribution">
    <div ref="plotRef" class="residual-plot-container"></div>
  </BaseCard>
</template>

<style scoped>
.residual-plot-container {
  width: 100%;
  min-height: 350px;
}
</style>
