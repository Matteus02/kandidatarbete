<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import Plotly from 'plotly.js-dist-min'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { EisDataPoint } from '@/types/eis'
import type { ModelData } from '@/composables/useCircuitModel'

const props = defineProps<{
  measurements: EisDataPoint[]
  modelTrace?: ModelData | null
  minFreq?: number | null
  maxFreq?: number | null
}>()

const nyquistRef = ref<HTMLElement | null>(null)
const bodeRef = ref<HTMLElement | null>(null)

const showCopyToast = ref(false)
const copiedFreq = ref('')

const handlePlotClick = (data: any) => {
  if (!data.points || data.points.length === 0) return
  
  const point = data.points[0]
  // We now consistently use customdata for the frequency value across all traces
  const freq = point.customdata
  
  if (typeof freq === 'number') {
    const freqStr = freq.toExponential(3)
    navigator.clipboard.writeText(freqStr)
    copiedFreq.value = freqStr
    showCopyToast.value = true
    setTimeout(() => {
      showCopyToast.value = false
    }, 2000)
  }
}

const drawPlots = () => {
  if (props.measurements.length === 0 || !nyquistRef.value || !bodeRef.value) return

  // --- Measurement Traces ---
  const freq = props.measurements.map(d => d['freq/Hz'])
  
  const opacities = freq.map(f => {
    const min = props.minFreq ?? -Infinity
    const max = props.maxFreq ?? Infinity
    return (f >= min && f <= max) ? 1.0 : 0.2
  })

  const measNyquist = {
    x: props.measurements.map(d => d['Re(Z)/Ohm']),
    y: props.measurements.map(d => d['-Im(Z)/Ohm']),
    customdata: freq,
    hovertemplate: 
      'Z\': %{x:.2f} Ω<br>' +
      '-Z\'\': %{y:.2f} Ω<br>' +
      'Freq: %{customdata:.2e} Hz<extra></extra>',
    mode: 'markers' as const,
    marker: { 
      size: 6, 
      color: '#007bff',
      opacity: opacities
    },
    type: 'scatter' as const,
    name: 'Measurement',
  }

  const measBodeMag = {
    x: freq,
    y: props.measurements.map(d => d['|Z|/Ohm']),
    customdata: freq,
    hovertemplate: 'Freq: %{x:.2e} Hz<br>|Z|: %{y:.2f} Ω<extra></extra>',
    mode: 'markers' as const,
    marker: { 
      size: 5, 
      color: '#007bff',
      opacity: opacities
    },
    type: 'scatter' as const,
    name: '|Z| (Meas)',
    xaxis: 'x' as const,
    yaxis: 'y' as const,
  }
  const measBodePhase = {
    x: freq,
    y: props.measurements.map(d => d['Phase(Z)/deg']),
    customdata: freq,
    hovertemplate: 'Freq: %{x:.2e} Hz<br>Phase: %{y:.2f}°<extra></extra>',
    mode: 'markers' as const,
    marker: { 
      size: 5, 
      color: '#28a745',
      opacity: opacities
    },
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
      customdata: modelFreq,
      hovertemplate: 
        '<b>%{name}</b><br>' +
        'Z\': %{x:.2f} Ω<br>' +
        '-Z\'\': %{y:.2f} Ω<br>' +
        'Freq: %{customdata:.2e} Hz<extra></extra>',
      mode: 'lines' as const,
      line: { color: '#e74c3c', width: 2 },
      type: 'scatter' as const,
      name: 'Model',
    }

    const modelBodeMag = {
      x: modelFreq,
      y: mag,
      customdata: modelFreq,
      hovertemplate: 'Freq: %{x:.2e} Hz<br>|Z|: %{y:.2f} Ω<extra></extra>',
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
      customdata: modelFreq,
      hovertemplate: 'Freq: %{x:.2e} Hz<br>Phase: %{y:.2f}°<extra></extra>',
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
    hoverlabel: {
      bgcolor: 'white',
      bordercolor: '#ccc',
      font: { color: '#333' }
    },
    xaxis: { title: { text: "Z' / Ω" }, zeroline: true },
    yaxis: {
      title: { text: "-Z'' / Ω" },
      zeroline: true,
      scaleanchor: 'x' as const,
      scaleratio: 1,
    },
    height: 550,
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
    height: 550,
    margin: { t: 50, r: 70, b: 50, l: 70 },
    showlegend: true,
    hovermode: 'x unified' as const,
  }

  const config = { responsive: true, displayModeBar: false }
  Plotly.react(nyquistRef.value, tracesNyquist, nyqLayout, config)
  Plotly.react(bodeRef.value, tracesBode, bodeLayout, config)

  // Attach click listeners (Plotly preserves listeners on react if element is same)
  // We use .off().on() to ensure we don't stack multiple listeners if this is called multiple times
  ;(nyquistRef.value as any).removeAllListeners?.('plotly_click')
  ;(bodeRef.value as any).removeAllListeners?.('plotly_click')
  
  ;(nyquistRef.value as any).on('plotly_click', handlePlotClick)
  ;(bodeRef.value as any).on('plotly_click', handlePlotClick)
}

onMounted(drawPlots)
watch(() => [props.measurements, props.modelTrace, props.minFreq, props.maxFreq], drawPlots, { deep: true })

function downloadPlotImage(type: 'nyquist' | 'bode') {
  const target = type === 'nyquist' ? nyquistRef.value : bodeRef.value
  if (!target) return
  Plotly.downloadImage(target, {
    format: 'png',
    filename: `spectra_${type}_plot`,
    width: 800,
    height: 600
  })
}

defineExpose({
  downloadPlotImage
})
</script>

<template>
  <BaseCard title="Analysis Plots">
    <div class="plots-container">
      <div ref="nyquistRef" class="plot-box" />
      <div ref="bodeRef" class="plot-box" />
    </div>

    <!-- Copy notification toast -->
    <Transition name="fade">
      <div v-if="showCopyToast" class="copy-toast">
        <span class="toast-icon">📋</span>
        Copied frequency: <strong>{{ copiedFreq }} Hz</strong>
      </div>
    </Transition>
  </BaseCard>
</template>

<style scoped>
.plots-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  width: 100%;
}

.plot-box {
  width: 100%;
  min-width: 0;
  height: 550px;
  overflow: hidden;
}

/* Toast Styles */
.copy-toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: #333;
  color: white;
  padding: 10px 20px;
  border-radius: 30px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.toast-icon {
  font-size: 18px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
  transform: translate(-50%, 20px);
}

@media (max-width: 900px) {
  .plots-container {
    grid-template-columns: 1fr;
  }
}
</style>
