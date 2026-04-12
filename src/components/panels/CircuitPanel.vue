<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { watch, onMounted, ref, computed } from 'vue'
import Plotly from 'plotly.js-dist-min'
import type { EisDataPoint } from '@/types/eis'
import ResistorSymbol from '@/components/circuit/ResistorSymbol.vue'
import CapacitorSymbol from '@/components/circuit/CapacitorSymbol.vue'
import CpeSymbol from '@/components/circuit/CpeSymbol.vue'
import WarburgSymbol from '@/components/circuit/WarburgSymbol.vue'

const layers = ref<1 | 2>(1)
const elementType = ref<'C' | 'CPE'>('C')
const warburg = ref(false)

const circuitString = computed(() => {
  const el = elementType.value === 'C' ? 'C' : 'CPE'
  const w = warburg.value ? '-W0' : ''
  if (layers.value === 1) return `R0-p(R1,${el}0)${w}`
  return `R0-p(R1,${el}0)-p(R2,${el}1)${w}`
})
//?
// SVG-layout: x-positioner för kretsen
// R0: x=20..80, P1: x=110..200, P2: x=220..310, W: centrerat på 250 (1 lager) eller 360 (2 lager)
const svgWidth = computed(() => {
  if (warburg.value) {
    const wCenter = layers.value === 2 ? 360 : 250
    return wCenter + 30 + 20  // höger kant av W + sluttråd
  }
  return (layers.value === 2 ? 310 : 200) + 20  // sista höger korsning + sluttråd
})

const warburgCenter = computed(() => layers.value === 2 ? 360 : 250)
//?

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
  <BaseCard title="Circuit">
    <div class="plot-wrapper">
      <div id="circuit-nyquist-plot" class="plot"></div>
      <div id="circuit-bode-plot" class="plot"></div>
    </div>
    <div class="circuit">
      <h3>Model Your Circuit</h3>

      <div class="selector-row">
        <span class="selector-label">Number of RC-layers:</span>
        <button :class="['choice-btn', { active: layers === 1 }]" @click="layers = 1">1</button>
        <button :class="['choice-btn', { active: layers === 2 }]" @click="layers = 2">2</button>
      </div>

      <div class="selector-row">
        <span class="selector-label">Elementtype:</span>
        <button :class="['choice-btn', { active: elementType === 'C' }]" @click="elementType = 'C'">C</button>
        <button :class="['choice-btn', { active: elementType === 'CPE' }]" @click="elementType = 'CPE'">CPE</button>
      </div>

      <div class="selector-row">
        <span class="selector-label">Warburg (diffusion):</span>
        <button :class="['choice-btn', { active: warburg === false }]" @click="warburg = false">No</button>
        <button :class="['choice-btn', { active: warburg === true }]" @click="warburg = true">Yes</button>
      </div>


      <div class="circuit-result">
        <span class="circuit-label">Circuit string:</span>
        <code class="circuit-string">{{ circuitString }}</code>
      </div>

      <!-- SVG-canvas: kretsen ritas här dynamiskt -->
      <div class="circuit-canvas">
        <svg :width="svgWidth" height="140" style="overflow: visible;">

          <!-- Vänster tråd + R0 -->
          <line x1="0" y1="70" x2="20" y2="70" stroke="#333" stroke-width="2"/>
          <g transform="translate(50, 70)"><ResistorSymbol label="R₀" /></g>

          <!-- Tråd R0 → P1 -->
          <line x1="80" y1="70" x2="110" y2="70" stroke="#333" stroke-width="2"/>

          <!-- P1: korsningar och trådar -->
          <line x1="110" y1="30" x2="110" y2="110" stroke="#333" stroke-width="2"/>
          <line x1="110" y1="30" x2="125" y2="30" stroke="#333" stroke-width="2"/>
          <line x1="185" y1="30" x2="200" y2="30" stroke="#333" stroke-width="2"/>
          <line x1="110" y1="110" x2="125" y2="110" stroke="#333" stroke-width="2"/>
          <line x1="185" y1="110" x2="200" y2="110" stroke="#333" stroke-width="2"/>
          <line x1="200" y1="30" x2="200" y2="110" stroke="#333" stroke-width="2"/>
          <!-- P1: element -->
          <g transform="translate(155, 30)"><ResistorSymbol label="R₁" /></g>
          <g transform="translate(155, 110)">
            <CapacitorSymbol v-if="elementType === 'C'" label="C₀" />
            <CpeSymbol v-else label="CPE₀" />
          </g>

          <!-- Tråd efter P1 -->
          <line x1="200" y1="70" x2="220" y2="70" stroke="#333" stroke-width="2"/>

          <!-- Parallellblock 2 -->
          <template v-if="layers === 2">
            <line x1="220" y1="30" x2="220" y2="110" stroke="#333" stroke-width="2"/>
            <line x1="220" y1="30" x2="235" y2="30" stroke="#333" stroke-width="2"/>
            <line x1="295" y1="30" x2="310" y2="30" stroke="#333" stroke-width="2"/>
            <line x1="220" y1="110" x2="235" y2="110" stroke="#333" stroke-width="2"/>
            <line x1="295" y1="110" x2="310" y2="110" stroke="#333" stroke-width="2"/>
            <line x1="310" y1="30" x2="310" y2="110" stroke="#333" stroke-width="2"/>
            <line x1="310" y1="70" x2="330" y2="70" stroke="#333" stroke-width="2"/>
            <g transform="translate(265, 30)"><ResistorSymbol label="R₂" /></g>
            <g transform="translate(265, 110)">
              <CapacitorSymbol v-if="elementType === 'C'" label="C₁" />
              <CpeSymbol v-else label="CPE₁" />
            </g>
          </template>

          <!-- Warburg -->
          <template v-if="warburg">
            <g :transform="`translate(${warburgCenter}, 70)`">
              <WarburgSymbol label="W₀" />
            </g>
            <line :x1="warburgCenter + 30" y1="70" :x2="svgWidth" y2="70" stroke="#333" stroke-width="2"/>
          </template>

        </svg>
      </div>

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

.circuit {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 16px;
}

.selector-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.selector-label {
  width: 180px;
  font-size: 14px;
}

.choice-btn {
  padding: 6px 16px;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  background: white;
  font-size: 14px;
}

.choice-btn.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.circuit-canvas {
  overflow-x: auto;
  padding: 12px 0;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fafafa;
}

.circuit-result {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.circuit-label {
  font-size: 14px;
  color: #666;
}

.circuit-string {
  font-size: 16px;
  font-weight: bold;
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
