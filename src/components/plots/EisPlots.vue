<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import Plotly from 'plotly.js-dist-min'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { EisDataPoint } from '@/types/eis'
import type { ModelData } from '@/composables/useCircuitModel'

const props = defineProps<{
  measurements: EisDataPoint[]
  modelTrace?: ModelData | null
}>()

const nyquistRef = ref<HTMLElement | null>(null)
const bodeRef = ref<HTMLElement | null>(null)

const drawPlots = () => {
  if (props.measurements.length === 0 || !nyquistRef.value || !bodeRef.value) return

  // --- Measurement Traces ---
  const measNyquist = {
    x: props.measurements.map(d => d['Re(Z)/Ohm']),
    y: props.measurements.map(d => d['-Im(Z)/Ohm']),
    mode: 'markers' as const,
    marker: { size: 6, color: '#007bff' },
    type: 'scatter' as const,
    name: 'Measurement',
  }
  const freq = props.measurements.map(d => d['freq/Hz'])

  const measBodeMag = {
    x: freq,
    y: props.measurements.map(d => d['|Z|/Ohm']),
    mode: 'markers' as const,
    marker: { size: 5, color: '#007bff' },
    type: 'scatter' as const,
    name: '|Z| (Meas)',
    xaxis: 'x' as const,
    yaxis: 'y' as const,
  }
  const measBodePhase = {
    x: freq,
    y: props.measurements.map(d => d['Phase(Z)/deg']),
    mode: 'markers' as const,
    marker: { size: 5, color: '#28a745' },
    type: 'scatter' as const,
    name: 'Phase (Meas)',
    xaxis: 'x' as const,
    yaxis: 'y2' as const,
  }

  const tracesNyquist: Plotly.Data[] = [measNyquist]
  const tracesBode: Plotly.Data[] = [measBodeMag, measBodePhase]

  // --- Model Traces ---
  if (props.modelTrace) {
    const { re, im, mag, phase, freq: modelFreq } = props.modelTrace

    const modelNyq = {
      x: re,
      y: im,
      mode: 'lines' as const,
      line: { color: '#e74c3c', width: 2 },
      type: 'scatter' as const,
      name: 'Model',
    }

    const modelBodeMag = {
      x: modelFreq,
      y: mag,
      mode: 'lines' as const,
      line: { color: '#e74c3c', width: 2 },
      type: 'scatter' as const,
      name: '|Z| (Model)',
      xaxis: 'x' as const,
      yaxis: 'y' as const,
    }

    const modelBodePhase = {
      x: modelFreq,
      y: phase,
      mode: 'lines' as const,
      line: { color: '#f39c12', width: 2, dash: 'dash' as const },
      type: 'scatter' as const,
      name: 'Phase (Model)',
      xaxis: 'x' as const,
      yaxis: 'y2' as const,
    }

    tracesNyquist.push(modelNyq)
    tracesBode.push(modelBodeMag, modelBodePhase)
  }

  // --- Layouts ---
  const nyqLayout = {
    title: { text: 'Nyquist Plot' },
    hovermode: 'closest' as const,
    xaxis: { title: { text: "Z' / Ω" }, zeroline: true },
    yaxis: {
      title: { text: "-Z'' / Ω" },
      zeroline: true,
      scaleanchor: 'x' as const,
      scaleratio: 1,
    },
    height: 400,
    margin: { t: 40, r: 20, b: 50, l: 60 },
    showlegend: true,
  }

  const bodeLayout = {
    title: { text: 'Bode Plot' },
    xaxis: {
      title: { text: 'Frequency / Hz' },
      type: 'log' as const,
      domain: [0, 1] as [number, number],
    },
    yaxis: {
      title: { text: '|Z| / Ω', font: { color: '#007bff' } },
      type: 'log' as const,
      domain: [0, 1] as [number, number],
      tickfont: { color: '#007bff' },
    },
    yaxis2: {
      title: { text: 'Phase / °', font: { color: '#28a745' } },
      side: 'right' as const,
      overlaying: 'y' as const,
      tickfont: { color: '#28a745' },
      zeroline: false,
    },
    height: 500,
    margin: { t: 50, r: 70, b: 50, l: 70 },
    showlegend: true,
    hovermode: 'x unified' as const,
  }

  Plotly.react(nyquistRef.value, tracesNyquist, nyqLayout)
  Plotly.react(bodeRef.value, tracesBode, bodeLayout)
}

onMounted(drawPlots)
watch(() => [props.measurements, props.modelTrace], drawPlots, { deep: true })
</script>

<template>
  <BaseCard title="Analysis Plots">
    <div class="plots-container">
      <div ref="nyquistRef" class="plot-box" />
      <div ref="bodeRef" class="plot-box" />
    </div>
  </BaseCard>
</template>

<style scoped>
.plots-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
  width: 100%;
}

.plot-box {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .plots-container {
    grid-template-columns: 1fr;
  }
}
</style>
