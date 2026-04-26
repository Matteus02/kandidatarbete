<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import SampleTabBar from '@/components/layout/SampleTabBar.vue'
import SampleWorkspace from '@/components/SampleWorkspace.vue'

interface SampleTab {
  id: string
  name: string
}

const samples = ref<SampleTab[]>([
  { id: 'sample-1', name: 'Sample 1' }
])

const activeSampleId = ref('sample-1')

const addSample = () => {
  const newId = `sample-${Date.now()}`
  samples.value.push({
    id: newId,
    name: `Sample ${samples.value.length + 1}`
  })
  activeSampleId.value = newId
}

const removeSample = (id: string) => {
  if (samples.value.length === 1) return // Keep at least one tab
  
  const index = samples.value.findIndex(s => s.id === id)
  samples.value.splice(index, 1)
  
  if (activeSampleId.value === id) {
    activeSampleId.value = samples.value[Math.max(0, index - 1)]!.id
  }
}

const selectSample = (id: string) => {
  activeSampleId.value = id
}

const updateSampleName = (id: string, name: string) => {
  const sample = samples.value.find(s => s.id === id)
  if (sample) sample.name = name
}
</script>

<template>
  <div class="app">
    <AppHeader />

    <SampleTabBar 
      :samples="samples"
      :active-sample-id="activeSampleId"
      @add="addSample"
      @remove="removeSample"
      @select="selectSample"
    />

    <main class="app__main">
      <div 
        v-for="sample in samples" 
        :key="sample.id"
        v-show="activeSampleId === sample.id"
      >
        <SampleWorkspace 
          :id="sample.id"
          @update-name="(name) => updateSampleName(sample.id, name)" 
        />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  width: 100%;
  max-width: none;
  padding: 0;
  margin: 0;
}

.app__main {
  display: flex;
  flex-direction: column;
}
</style>
