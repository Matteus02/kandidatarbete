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

      Plotly.newPlot('nyquist-plot', [nyquistTrace], nyquistLayout)
      Plotly.newPlot('bode-plot', [bodeMagTrace], bodeLayout)
}

// Rita graferna så fort komponenten laddas eller datan ändras
onMounted(drawPlots)
watch(() => props.eisData, drawPlots)
</script>

<template>
  <BaseCard title="Plot">
    <div id="nyquist-plot"></div>
      <div id="bode-plot"></div>
  </BaseCard>
</template>

<style scoped>
.placeholder {
  color: var(--color-text-muted);
  margin: 0;
}
</style>
