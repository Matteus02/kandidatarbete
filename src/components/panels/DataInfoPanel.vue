<script setup lang="ts">
import { computed, ref } from 'vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { EisDataPoint, LocalStore } from '@/types/eis'
import { performKKTest } from '@/utils/kramersKronig'

const props = defineProps<{
  dataPoints: EisDataPoint[]
  localStore: LocalStore
  isFiltered?: boolean
}>()

const stats = computed(() => {
  if (props.dataPoints.length === 0) return null

  const freqs = props.dataPoints.map(d => d['freq/Hz'])
  const magnitudes = props.dataPoints.map(d => d['|Z|/Ohm'])

  const subset = props.dataPoints.filter(d => {
    const f = d['freq/Hz']
    const min = props.localStore.minFreq ?? -Infinity
    const max = props.localStore.maxFreq ?? Infinity
    return f >= min && f <= max
  })

  return {
    count: props.dataPoints.length,
    subsetCount: subset.length,
    minFreq: Math.min(...freqs),
    maxFreq: Math.max(...freqs),
    minZ: Math.min(...magnitudes),
    maxZ: Math.max(...magnitudes),
  }
})

// Format helper for scientific notation or large numbers
const formatNum = (num: number) => {
  if (num === 0) return '0'
  if (Math.abs(num) < 0.1 || Math.abs(num) > 10000) {
    return num.toExponential(2)
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

const isValidating = ref(false)

function runValidation() {
  if (props.dataPoints.length === 0) return

  isValidating.value = true

  // Small delay for UX feedback
  setTimeout(() => {
    const freqs = props.dataPoints.map(d => d['freq/Hz'])
    const zReal = props.dataPoints.map(d => d['Re(Z)/Ohm'])
    const zImag = props.dataPoints.map(d => d['-Im(Z)/Ohm'])

    const result = performKKTest(freqs, zReal, zImag)
    props.localStore.setKkResult(result)
    isValidating.value = false
  }, 400)
}

function getStatusClass(isConsistent: boolean) {
  return isConsistent ? 'status-pass' : 'status-warn'
}
</script>

<template>
  <BaseCard title="Data Information">
    <div class="info-panel">
      <div v-if="!stats" class="empty-state">
        <p>No data loaded.</p>
        <p class="hint">Upload a CSV file to see statistics.</p>
      </div>

      <div v-else class="stats-list">
        <div v-if="isFiltered" class="filter-warning">
          <span>Filter active: Calculations use subset</span>
        </div>

        <div class="stat-item">
          <span class="label">Data Points:</span>
          <span class="value">{{ stats.count }}</span>
        </div>
        <div v-if="isFiltered" class="stat-item subset-row">
          <span class="label">└ Subset:</span>
          <span class="value value--subset">{{ stats.subsetCount }}</span>
        </div>

        <div class="stat-divider">Frequency Range</div>
        <div class="stat-item">
          <span class="label">Min:</span>
          <span class="value">{{ formatNum(stats.minFreq) }} Hz</span>
        </div>
        <div class="stat-item">
          <span class="label">Max:</span>
          <span class="value">{{ formatNum(stats.maxFreq) }} Hz</span>
        </div>

        <div class="stat-divider">Impedance Range (|Z|)</div>
        <div class="stat-item">
          <span class="label">Min:</span>
          <span class="value">{{ formatNum(stats.minZ) }} Ω</span>
        </div>
        <div class="stat-item">
          <span class="label">Max:</span>
          <span class="value">{{ formatNum(stats.maxZ) }} Ω</span>
        </div>

        <div class="stat-divider">Kramers-Kronig Validation</div>

        <div v-if="localStore.kkResult" class="kk-result">
          <div class="kk-badge-row">
            <span :class="['kk-status-badge', getStatusClass(localStore.kkResult.isConsistent)]">
              {{ localStore.kkResult.isConsistent ? 'PASS' : 'WARNING' }}
            </span>
            <span class="kk-timestamp">{{ new Date(localStore.kkResult.testedAt).toLocaleTimeString() }}</span>
          </div>
          <p class="kk-message">{{ localStore.kkResult.message }}</p>
        </div>

        <button
          class="kk-btn"
          :disabled="isValidating"
          @click="runValidation"
        >
          <span v-if="isValidating">Evaluating...</span>
          <span v-else>{{ localStore.kkResult ? 'Re-run Validation' : 'Run KK Validation' }}</span>
        </button>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.info-panel {
  font-size: 14px;
}

.empty-state {
  color: #888;
  text-align: center;
  padding: 10px 0;
}

.hint {
  font-size: 12px;
  margin-top: 4px;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
  margin-bottom: 4px;
}


.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.label {
  color: #666;
  font-weight: 500;
}

.value {
  font-family: monospace;
  font-weight: 600;
  color: #333;
}

.subset-row {
  margin-top: -4px;
  padding-left: 8px;
}

.value--subset {
  color: #007bff;
}

.stat-divider {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #999;
  border-bottom: 1px solid #eee;
  padding-bottom: 2px;
  margin-top: 14px;
  margin-bottom: 4px;
}

.kk-btn {
  width: 100%;
  margin-top: 4px;
  padding: 8px;
  font-size: 12px;
  font-weight: 600;
  background: white;
  border: 1px solid #007bff;
  color: #007bff;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.kk-btn:hover:not(:disabled) {
  background: #f0f7ff;
}

.kk-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.kk-result {
  background: #fcfcfc;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 4px;
}

.kk-badge-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.kk-status-badge {
  font-size: 10px;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 3px;
  color: white;
}

.status-pass { background-color: #28a745; }
.status-warn { background-color: #f39c12; }

.kk-timestamp {
  font-size: 10px;
  color: #aaa;
}

.kk-message {
  font-size: 12px;
  line-height: 1.4;
  margin: 0;
  color: #444;
}
</style>
