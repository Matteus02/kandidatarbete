<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { EisDataPoint } from '@/types/eis'
import type { InferenceRequest, InferenceResponse } from '@/ai/workerProtocol'
import InferenceWorker from '@/workers/eisInference.worker.ts?worker'

const props = defineProps<{ 
  eisData: EisDataPoint[]
  localStore: any // Using any for simplicity in this refactor, but it matches the store interface
}>()
const emit = defineEmits<{ (e: 'apply-circuit', circuit: string): void }>()

const isLoading = ref(false)
const errorMessage = ref<string | null>(null)
const predictions = computed(() => props.localStore.aiSuggestions)

let worker: Worker | null = null

function getWorker(): Worker {
  if (!worker) {
    worker = new InferenceWorker()
    worker.onmessage = (event: MessageEvent<InferenceResponse>) => {
      isLoading.value = false
      if (event.data.type === 'error') {
        errorMessage.value = event.data.message
        return
      }
      props.localStore.setAiSuggestions(event.data.predictions)
    }
    worker.onerror = (e) => {
      isLoading.value = false
      errorMessage.value = e.message
    }
  }
  return worker
}

onUnmounted(() => {
  if (worker) {
    worker.terminate()
    worker = null
  }
})

function runDetection(): void {
  if (props.eisData.length === 0) {
    errorMessage.value = 'No EIS data loaded. Upload a file in the Data tab first.'
    return
  }
  errorMessage.value = null
  isLoading.value = true

  const request: InferenceRequest = {
    type: 'run',
    data: props.eisData.map((d) => ({
      'Re(Z)/Ohm': d['Re(Z)/Ohm'],
      '-Im(Z)/Ohm': d['-Im(Z)/Ohm'],
      'freq/Hz': d['freq/Hz'],
      'Phase(Z)/deg': d['Phase(Z)/deg'],
    })),
  }
  getWorker().postMessage(request)
}
</script>

<template>
  <BaseCard title="AI Circuit Detection">
    <div v-if="props.eisData.length === 0" class="ai-empty">
      <p>Load EIS data in the Data tab before running detection.</p>
    </div>

    <template v-else>
      <div class="ai-controls">
        <button class="ai-btn-primary" :disabled="isLoading" @click="runDetection">
          {{ isLoading ? 'Detecting…' : 'Detect ECM' }}
        </button>
        <span v-if="isLoading" class="ai-spinner" aria-live="polite">
          <span class="spinner-dot" />
          <span class="spinner-dot" />
          <span class="spinner-dot" />
        </span>
      </div>

      <p v-if="errorMessage" class="ai-error" role="alert">{{ errorMessage }}</p>

      <ul v-if="predictions.length > 0" class="ai-results">
        <li v-for="p in predictions" :key="p.circuit" class="ai-result-item">
          <div class="ai-result-header">
            <code class="ai-circuit-label">{{ p.circuit }}</code>
            <span class="ai-confidence-pct">{{ (p.confidence * 100).toFixed(1) }}%</span>
            <button class="ai-btn-apply" @click="emit('apply-circuit', p.circuit)">Apply</button>
          </div>
          <div class="ai-bar-track">
            <div class="ai-bar-fill" :style="{ width: (p.confidence * 100).toFixed(2) + '%' }" />
          </div>
        </li>
      </ul>
    </template>
  </BaseCard>
</template>

<style scoped>
.ai-empty {
  color: var(--color-text-muted, #888);
  font-size: 14px;
  padding: 16px 0;
}

.ai-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.ai-btn-primary {
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 20px;
  font-size: 15px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.ai-btn-primary:hover:not(:disabled) {
  background: #0056b3;
}

.ai-btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-spinner {
  display: flex;
  gap: 4px;
  align-items: center;
}

.spinner-dot {
  width: 8px;
  height: 8px;
  background: #007bff;
  border-radius: 50%;
  animation: bounce 0.8s infinite alternate;
}

.spinner-dot:nth-child(2) { animation-delay: 0.2s; }
.spinner-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes bounce {
  from { transform: translateY(0); opacity: 0.5; }
  to   { transform: translateY(-6px); opacity: 1; }
}

.ai-error {
  color: #c0392b;
  font-size: 14px;
  margin: 8px 0;
  padding: 8px 12px;
  background: #fdf2f2;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
}

.ai-results {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ai-result-item {
  background: #fafafa;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px 14px;
}

.ai-result-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.ai-circuit-label {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
}

.ai-confidence-pct {
  font-size: 14px;
  font-weight: 600;
  color: #007bff;
  min-width: 46px;
  text-align: right;
}

.ai-btn-apply {
  background: white;
  color: #007bff;
  border: 1px solid #007bff;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
}

.ai-btn-apply:hover {
  background: #007bff;
  color: white;
}

.ai-bar-track {
  height: 6px;
  background: #e0e0e0;
  border-radius: 3px;
  overflow: hidden;
}

.ai-bar-fill {
  height: 100%;
  background: #007bff;
  border-radius: 3px;
  transition: width 0.4s ease;
}
</style>
