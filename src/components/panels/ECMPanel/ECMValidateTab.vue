<script setup lang="ts">
import { computed } from 'vue'
import type { CircuitNode } from '@/utils/CircuitNode'
import type { EisDataPoint } from '@/types/eis'
import type { ModelData } from '@/composables/useCircuitModel'
import ResidualPlot from './ResidualPlot.vue'
import { calculateChiSquared } from '@/utils/chiSquared'
import { calculateResiduals } from '@/utils/residuals'

const props = defineProps<{
  rootNode: CircuitNode
  eisData: EisDataPoint[]
  modelData: ModelData | null
}>()

const chiSquared = computed(() => {
  if (!props.modelData || props.eisData.length === 0) return null

  const measRe = props.eisData.map(d => d['Re(Z)/Ohm'])
  const measIm = props.eisData.map(d => -d['-Im(Z)/Ohm'])
  const modRe = props.modelData.re
  const modIm = props.modelData.im.map(v => -v)

  return calculateChiSquared(measRe, measIm, modRe, modIm)
})

const residuals = computed(() => {
  if (!props.modelData || props.eisData.length === 0) return { re: [], im: [] }

  const measRe = props.eisData.map(d => d['Re(Z)/Ohm'])
  const measIm = props.eisData.map(d => -d['-Im(Z)/Ohm'])
  const modRe = props.modelData.re
  const modIm = props.modelData.im.map(v => -v)

  return calculateResiduals(measRe, measIm, modRe, modIm)
})
</script>

<template>
  <div class="ecm-validate-tab">
    <div class="validation-top">
      <div class="validation-card">
        <h4 class="card-title">Fit Quality (χ²)</h4>
        <div class="card-content">
          <div v-if="chiSquared !== null" class="result-display">
            <div class="chi-value">{{ chiSquared.toExponential(3) }}</div>
          </div>
          <div v-else class="placeholder-text">
            No data or model to evaluate.
          </div>
        </div>
      </div>
    </div>

    <!-- Residual Analysis Plot -->
    <div v-if="chiSquared !== null" class="residual-section">
      <ResidualPlot 
        :frequencies="eisData.map(d => d['freq/Hz'])"
        :residuals-re="residuals.re"
        :residuals-im="residuals.im"
      />
    </div>
  </div>
</template>

<style scoped>
.validation-top {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  margin-bottom: 20px;
}

.validation-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
}

.card-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  margin: 0 0 12px 0;
  letter-spacing: 0.05em;
}

.card-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.result-display {
  text-align: center;
}

.chi-value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  font-family: monospace;
}

.placeholder-text {
  color: #94a3b8;
  font-size: 13px;
  font-style: italic;
  text-align: center;
}

.residual-section {
  margin-top: 10px;
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 800px) {
  .validation-top {
    grid-template-columns: 1fr;
  }
}
</style>
