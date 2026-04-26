<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { ref, computed } from 'vue'
import type { EisDataPoint } from '@/types/eis'
import { parseEisCsv } from '@/utils/csvParser'

const props = defineProps<{
  id: string
  initialFileName: string
  initialData: EisDataPoint[]
}>()

const inputId = computed(() => `eis-upload-${props.id}`)

const fileName = ref(props.initialFileName)
const parsedData = ref<EisDataPoint[]>(props.initialData)

const emit = defineEmits<{
  (e: 'analysis-complete', data: EisDataPoint[], fileName: string): void
}>()

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
          <span class="file-icon">📄</span>
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

.file-icon {
  font-size: 16px;
  flex-shrink: 0;
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
</style>
