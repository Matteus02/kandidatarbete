<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { ref, watch, onMounted } from 'vue'
import Plotly from 'plotly.js-dist-min'
import type { EisDataPoint } from '@/types/eis'

const props = defineProps<{
  eisData: EisDataPoint[]
}>()

const nyquistRef = ref<HTMLElement | null>(null)
const bodeRef = ref<HTMLElement | null>(null)

const drawPlots = () => {
  if (props.eisData.length === 0 || !nyquistRef.value || !bodeRef.value) return

  const zReal = props.eisData.map((d) => d['Re(Z)/Ohm'])
      const zImag = props.eisData.map((d) => d['-Im(Z)/Ohm'])

      const nyquistTrace = {
        x: zReal,
        y: zImag,
        mode: 'markers' as const, // EIS-data visas oftast bäst med bara punkter eller punkter+linjer
        marker: { size: 6, color: '#007bff' },
        type: 'scatter' as const,
        name: 'Measurement',
      }

      const nyquistLayout = {
        title: { text: 'Nyquist Plot' }, // Ändra från sträng till objekt
        hovermode: 'closest' as const,
        xaxis: { title: { text: "Z' / Ω" }, zeroline: true }, // Även axeltitlar vill ha objekt
        yaxis: {
          title: { text: "-Z'' / Ω" },
          zeroline: true,
          scaleanchor: 'x' as const,
          scaleratio: 1,
        },
      }

      // 2. Bode-data: Frekvens vs |Z| och fas — två subplottar i samma div
      const freq = props.eisData.map((d) => d['freq/Hz'])
      const zMag = props.eisData.map((d) => d['|Z|/Ohm'])
      const phase = props.eisData.map((d) => d['Phase(Z)/deg'])

      const bodeMagTrace = {
        x: freq,
        y: zMag,
        mode: 'lines+markers' as const,
        type: 'scatter' as const,
        name: '|Z|',
        xaxis: 'x' as const,
        yaxis: 'y' as const,
      }

      const bodePhaseTrace = {
        x: freq,
        y: phase,
        mode: 'lines+markers' as const,
        type: 'scatter' as const,
        name: 'Phase',
        line: { color: '#e67e22' },
        marker: { color: '#e67e22' },
        xaxis: 'x' as const,
        yaxis: 'y2' as const,
      }

      const bodeLayout = {
        title: { text: 'Bode Plot' },
        grid: { rows: 2, columns: 1 },
        xaxis: {
          title: { text: 'Frequency / Hz' },
          type: 'log' as const,
          domain: [0, 1] as [number, number],
        },
        yaxis: {
          title: { text: '|Z| / Ω' },
          type: 'log' as const,
          domain: [0.55, 1] as [number, number],
        },
        yaxis2: {
          title: { text: 'Phase / °' },
          domain: [0, 0.45] as [number, number],
          anchor: 'x' as const,
        },
        height: 500,
        margin: { t: 50, r: 20, b: 50, l: 70 },
        showlegend: true,
      }

      Plotly.newPlot(nyquistRef.value, [nyquistTrace], nyquistLayout)
      Plotly.newPlot(bodeRef.value, [bodeMagTrace, bodePhaseTrace], bodeLayout)
}
const emit = defineEmits(['model-circuit'])

const modelCircuit = () => {
  emit('model-circuit')
}

onMounted(drawPlots)
watch(() => props.eisData, drawPlots)
</script>

<template>
  <BaseCard title="Plot">
    <div ref="nyquistRef"></div>
    <div ref="bodeRef"></div>
    <button class="model-circuit-button" @click="modelCircuit">Model Circuit</button>
  </BaseCard>
</template>

<style scoped>

.model-circuit-button {
 background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.model-circuit-button:hover {
  background-color: #0056b3;
}

</style>
