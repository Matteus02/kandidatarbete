<script setup lang="ts">
import { computed, reactive } from 'vue'
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

const validationState = reactive({
  chiSquared: null as number | null,
  residuals: { re: [] as number[], im: [] as number[] }
})

function evaluateModel() {
  if (!props.modelData || props.eisData.length === 0) return

  const measRe = props.eisData.map(d => d['Re(Z)/Ohm'])
  const measIm = props.eisData.map(d => -d['-Im(Z)/Ohm'])
  const modRe = props.modelData.re
  const modIm = props.modelData.im.map(v => -v)

  validationState.chiSquared = calculateChiSquared(measRe, measIm, modRe, modIm)
  validationState.residuals = calculateResiduals(measRe, measIm, modRe, modIm)
}

const fitQualityLabel = computed(() => {
  const val = validationState.chiSquared
  if (val === null) return ''
  if (val < 1e-4) return 'Excellent'
  if (val < 1e-3) return 'Good'
  if (val < 1e-2) return 'Fair'
  return 'Poor'
})

const fitQualityClass = computed(() => {
  const val = validationState.chiSquared
  if (val === null) return ''
  if (val < 1e-3) return 'quality-good'
  if (val < 1e-2) return 'quality-fair'
  return 'quality-poor'
})
</script>

<template>
  <div class="ecm-validate-tab">
    <div class="validation-top">
      
      <!-- fit Quality Section -->
      <div class="validation-card">
        <h4 class="card-title">Fit Quality (χ²)</h4>
        <div class="card-content">
          <div v-if="validationState.chiSquared !== null" class="result-display">
            <div class="chi-value">{{ validationState.chiSquared.toExponential(3) }}</div>
            <div :class="['quality-badge', fitQualityClass]">{{ fitQualityLabel }}</div>
          </div>
          <div v-else class="placeholder-text">
            No evaluation performed yet.
          </div>
          
          <button 
            class="action-btn" 
            :disabled="!modelData || eisData.length === 0"
            @click="evaluateModel"
          >
            Evaluate Current Fit
          </button>
        </div>
      </div>

      <div class="validation-info">
        <h5>About Validation</h5>
        <p>
          The χ² value measures the normalized weighted difference between your model and the experimental data. 
          A value below 10⁻³ typically indicates a good physical fit. Residual analysis helps identify systematic errors across frequencies.
        </p>
      </div>
    </div>

    <!-- Residual Analysis Plot -->
    <div v-if="validationState.chiSquared !== null" class="residual-section">
      <ResidualPlot 
        :frequencies="eisData.map(d => d['freq/Hz'])"
        :residuals-re="validationState.residuals.re"
        :residuals-im="validationState.residuals.im"
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
  justify-content: space-between;
}

.result-display {
  text-align: center;
  margin-bottom: 16px;
}

.chi-value {
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  font-family: monospace;
}

.quality-badge {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}

.quality-good { background: #dcfce7; color: #166534; }
.quality-fair { background: #fef9c3; color: #854d0e; }
.quality-poor { background: #fee2e2; color: #991b1b; }

.placeholder-text {
  color: #94a3b8;
  font-size: 13px;
  font-style: italic;
  margin-bottom: 16px;
}

.action-btn {
  width: 100%;
  padding: 10px;
  font-size: 13px;
  font-weight: 600;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.action-btn:hover:not(:disabled) {
  background: #0056b3;
}

.action-btn:disabled {
  background: #e2e8f0;
  color: #94a3b8;
  cursor: not-allowed;
}

.validation-info {
  padding: 16px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.validation-info h5 {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #475569;
}

.validation-info p {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
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
