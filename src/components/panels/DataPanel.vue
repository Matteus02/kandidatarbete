<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { ref } from 'vue'
import * as Papa from 'papaparse'
import type { EisDataPoint } from '@/types/eis'

interface EISData {
  'freq/Hz': number
  'Re(Z)/Ohm': number
  '-Im(Z)/Ohm': number
  '|Z|/Ohm': number
  'Phase(Z)/deg': number
  // Du kan lägga till fler kolumner här om du behöver dem senare
}

const props = defineProps<{
  initialFileName: string
  initialData: EisDataPoint[]
}>()

const fileName = ref(props.initialFileName)
const parsedData = ref<EISData[]>(props.initialData)
const isAnalyzing = ref(false)

const onFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (file) {
    fileName.value = file.name
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        console.log('Data laddades upp:', results.data)
        parsedData.value = results.data as EISData[]
      },
    })
  }
}

const emit = defineEmits(['analysis-complete'])

const generatePlots = () => {
  console.log('Knappen trycktes! Nu börjar vi plotta...')

  if (parsedData.value.length > 0) {
    isAnalyzing.value = true

    setTimeout(() => {
      isAnalyzing.value = false
      emit('analysis-complete', parsedData.value, fileName.value)
    }, 1500)
  } else {
    alert('No data found.')
  }
}
</script>

<template>
  <BaseCard title="Data">
    <div class="data-panel">
      <h3>Upload EIS-data</h3>
      <p>Choose a .csv-file for analysis!</p>
      <input type="file" @change="onFileChange" accept=".csv" />
      <p v-if="fileName">Uploaded file: {{ fileName }}</p>
      <button class="analyse-file-button" @click="generatePlots">Analyze Data</button>
      <div v-if="isAnalyzing" class="overlay">
        <div class="loader-content">
          <div class="spinner"></div>
          <p>Analyzing EIS-data...</p>
        </div>
      </div>

    </div>
  </BaseCard>
</template>

<style scoped>
.data-panel {
  display: flex;
  flex-direction: column;
  gap: 15px; /* Detta ger ett snyggt mellanrum mellan filväljaren och knappen */
  align-items: flex-start;
}

.placeholder {
  color: var(--color-text-muted);
  margin: 0;
}
.analyse-file-button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.3s;
}

.analyse-file-button:hover {
  background-color: #0056b3;
}

.overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7); /* Svart med 70% genomskinlighet */
  display: flex;
  justify-content: center;
  align-items: center;
  color: white;
}

.loader-content {
  text-align: center;
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top: 4px solid #ffffff;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
  margin: 0 auto 15px;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}
</style>
