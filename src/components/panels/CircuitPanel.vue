<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { watch, onMounted } from 'vue'
import Plotly from 'plotly.js-dist-min'
import type { EisDataPoint } from '@/types/eis'

const props = defineProps<{
  eisData: EisDataPoint[]
}>()

const drawPlots = () => {
  if (props.eisData.length === 0) return

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
    height: 400,
    margin: { t: 40, r: 20, b: 50, l: 60 },
  }

  // 2. Bode-data: Frekvens vs |Z|
  const freq = props.eisData.map((d) => d['freq/Hz'])
  const zMag = props.eisData.map((d) => d['|Z|/Ohm'])
  //const phase = fileName.value.map(d => d['Phase(Z)/deg'])

  const bodeMagTrace = {
    x: freq,
    y: zMag,
    mode: 'lines+markers' as const,
    type: 'scatter' as const,
    name: 'Magnitude',
  }

  const bodeLayout = {
    title: { text: 'Bode Plot (Magnitude)' },
    xaxis: {
      title: { text: 'Frequency / Hz' },
      type: 'log' as const,
    },
    yaxis: {
      title: { text: '|Z| / Ω' },
      type: 'log' as const,
    },
  }

  Plotly.newPlot('circuit-nyquist-plot', [nyquistTrace], nyquistLayout)
  Plotly.newPlot('circuit-bode-plot', [bodeMagTrace], bodeLayout)
}

const modelModeledCircuit = () => {

}

onMounted(drawPlots)
watch(() => props.eisData, drawPlots)
</script>

<template>
  <BaseCard title="Plot">
    <div class="plot-wrapper">
      <div id="circuit-nyquist-plot" class="plot"></div>
      <div id="circuit-bode-plot" class="plot"></div>
    </div>
    <div class="circuit">
      <h3>Modeled Circuit</h3>
      
    </div>
    <button class="model-modeled-circuit-button" @click="modelModeledCircuit">Plot Data with Circuit</button>
  </BaseCard>
</template>

<style scoped>
.plot {
  flex: 1;
  min-width: 0;
}
.plot-wrapper {
  flex-direction: row;
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
}

.model-modeled-circuit-button {
 background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.model-modeled-circuit-button:hover {
  background-color: #0056b3;
}
</style>
