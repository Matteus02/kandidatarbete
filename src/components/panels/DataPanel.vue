<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { ref, computed, watch } from 'vue'
import type { EisDataPoint } from '@/types/eis'
import { parseEisCsv } from '@/utils/csvParser'

const props = defineProps<{
  id: string
  initialFileName: string
  initialData: EisDataPoint[]
  minFreq: number | null
  maxFreq: number | null
}>()

const inputId = computed(() => `eis-upload-${props.id}`)

const fileName = ref(props.initialFileName)
const parsedData = ref<EisDataPoint[]>(props.initialData)

const emit = defineEmits<{
  (e: 'analysis-complete', data: EisDataPoint[], fileName: string): void
  (e: 'update:freq-range', min: number | null, max: number | null): void
}>()

const localMinFreq = ref<number | string>(props.minFreq ?? '')
const localMaxFreq = ref<number | string>(props.maxFreq ?? '')

watch(() => props.minFreq, (newVal) => { localMinFreq.value = newVal ?? '' })
watch(() => props.maxFreq, (newVal) => { localMaxFreq.value = newVal ?? '' })

const handleFreqChange = () => {
  const min = localMinFreq.value === '' ? null : Number(localMinFreq.value)
  const max = localMaxFreq.value === '' ? null : Number(localMaxFreq.value)
  emit('update:freq-range', min, max)
}

const resetFreqRange = () => {
  localMinFreq.value = ''
  localMaxFreq.value = ''
  handleFreqChange()
}

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    fileName.value = file.name
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      try {
        const parsed = parseEisCsv(text)
        parsedData.value = parsed
        emit('analysis-complete', parsed, fileName.value)
      } catch (err) {
        console.error('Error parsing CSV:', err)
        alert('Failed to parse CSV file.')
      }
    }
    reader.readAsText(file)
  }
}
</script>

<template>
  <BaseCard title="Data Upload">
    <div class="data-panel">
      <p v-if="!fileName" class="instruction">Choose a .csv-file to begin analysis!</p>

      <div v-if="fileName" class="active-file-info">
        <div class="file-name-display">
          <span class="name-text" :title="fileName">{{ fileName }}</span>
        </div>
        <div class="success-message">File loaded successfully.</div>
      </div>

      <div class="file-input-wrapper">
        <input
          type="file"
          :id="inputId"
          @change="onFileChange"
          accept=".csv"
          class="hidden-input"
        />
        <label :for="inputId" class="file-label" :class="{ 'file-label--change': fileName }">
          {{ fileName ? 'Change File' : 'Select File...' }}
        </label>
      </div>

      <div v-if="fileName" class="filter-section">
        <div class="section-divider">Frequency Range Filter</div>
        <div class="filter-inputs">
          <div class="input-group">
            <label :for="'min-f-' + props.id">Min (Hz)</label>
            <input 
              type="text" 
              :id="'min-f-' + props.id" 
              v-model="localMinFreq" 
              @change="handleFreqChange"
              placeholder="Min"
            />
          </div>
          <div class="input-group">
            <label :for="'max-f-' + props.id">Max (Hz)</label>
            <input 
              type="text" 
              :id="'max-f-' + props.id" 
              v-model="localMaxFreq" 
              @change="handleFreqChange"
              placeholder="Max"
            />
          </div>
        </div>
        <button v-if="localMinFreq !== '' || localMaxFreq !== ''" class="reset-link" @click="resetFreqRange">
          Reset Filter
        </button>
      </div>
    </div>
  </BaseCard>
</template>

<style scoped>
.data-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: stretch;
}

.instruction {
  font-size: 13px;
  color: #666;
  margin: 0;
}

.active-file-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px;
}

.file-name-display {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}


.name-text {
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-input-wrapper {
  position: relative;
}

.hidden-input {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.file-label {
  display: block;
  padding: 10px 12px;
  background: #f8f9fa;
  border: 1px solid #ced4da;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  text-align: center;
  transition: all 0.2s;
  font-weight: 500;
}

.file-label:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.file-label--change {
  background: white;
  border-color: #007bff;
  color: #007bff;
  padding: 6px 12px;
  font-size: 12px;
}

.file-label--change:hover {
  background: #f0f7ff;
  border-color: #0056b3;
}

.success-message {
  font-size: 11px;
  color: #28a745;
  font-weight: 500;
}

.filter-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid #eee;
}

.section-divider {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #94a3b8;
  letter-spacing: 0.025em;
}

.filter-inputs {
  display: flex;
  gap: 12px;
}

.input-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.input-group label {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
}

.input-group input {
  width: 100%;
  padding: 6px 8px;
  font-size: 13px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #1e293b;
  font-family: monospace;
}

.input-group input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.reset-link {
  align-self: flex-start;
  background: none;
  border: none;
  color: #ef4444;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

.reset-link:hover {
  color: #dc2626;
}
</style>
