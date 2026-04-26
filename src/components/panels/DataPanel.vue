<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { ref } from 'vue'
import type { EisDataPoint } from '@/types/eis'
import { parseEisCsv } from '@/utils/csvParser'

const props = defineProps<{
  initialFileName: string
  initialData: EisDataPoint[]
}>()

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
      <p class="instruction">Choose a .csv-file to begin analysis!</p>
      
      <div class="file-input-wrapper">
        <input 
          type="file" 
          id="eis-upload" 
          @change="onFileChange" 
          accept=".csv" 
          class="hidden-input"
        />
        <label for="eis-upload" class="file-label">
          {{ fileName || 'Select File...' }}
        </label>
      </div>

      <div v-if="fileName" class="success-message">
        File loaded successfully.
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

.success-message {
  font-size: 12px;
  color: #28a745;
  text-align: center;
  font-weight: 500;
}
</style>
