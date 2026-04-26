<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { EisDataPoint } from '@/types/eis'

const props = defineProps<{
  dataPoints: EisDataPoint[]
}>()

const stats = computed(() => {
  if (props.dataPoints.length === 0) return null

  const freqs = props.dataPoints.map(d => d['freq/Hz'])
  const magnitudes = props.dataPoints.map(d => d['|Z|/Ohm'])

  return {
    count: props.dataPoints.length,
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
</script>

<template>
  <BaseCard title="Data Information">
    <div class="info-panel">
      <div v-if="!stats" class="empty-state">
        <p>No data loaded.</p>
        <p class="hint">Upload a CSV file to see statistics.</p>
      </div>
      
      <div v-else class="stats-list">
        <div class="stat-item">
          <span class="label">Data Points:</span>
          <span class="value">{{ stats.count }}</span>
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

.stat-divider {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #999;
  border-bottom: 1px solid #eee;
  padding-bottom: 2px;
  margin-top: 8px;
}
</style>
