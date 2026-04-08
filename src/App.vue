<script setup lang="ts">
import { ref } from 'vue'
import BaseTabs from '@/components/ui/BaseTabs.vue'
import BaseTabPanel from '@/components/ui/BaseTabPanel.vue'
import type { TabItem } from '@/components/ui/tabsContext'
import DataPanel from '@/components/panels/DataPanel.vue'
import PlotPanel from '@/components/panels/PlotPanel.vue'
import CircuitPanel from '@/components/panels/CircuitPanel.vue'
import FitPanel from '@/components/panels/FitPanel.vue'
import ExportPanel from '@/components/panels/ExportPanel.vue'

const tabs = [
  { id: 'data', label: 'Data' },
  { id: 'plot', label: 'Plot' },
  { id: 'circuit', label: 'Circuit' },
  { id: 'fit', label: 'Fit' },
  { id: 'export', label: 'Export' },
] as const satisfies readonly TabItem[]

type TabId = (typeof tabs)[number]['id']

const activeTab = ref<TabId>('data')
</script>

<template>
  <div class="app">
    <header class="app__header">
      <h1 class="app__title">EIS Analyzer</h1>
      <p class="app__subtitle">Electrochemical Impedance Spectroscopy</p>
    </header>

    <main class="app__main">
      <BaseTabs :tabs="tabs" v-model="activeTab">
        <BaseTabPanel tab-id="data"><DataPanel /></BaseTabPanel>
        <BaseTabPanel tab-id="plot"><PlotPanel /></BaseTabPanel>
        <BaseTabPanel tab-id="circuit"><CircuitPanel /></BaseTabPanel>
        <BaseTabPanel tab-id="fit"><FitPanel /></BaseTabPanel>
        <BaseTabPanel tab-id="export"><ExportPanel /></BaseTabPanel>
      </BaseTabs>
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-4);
}

.app__header {
  margin-bottom: var(--space-5);
}

.app__title {
  font-size: 24px;
  font-weight: 600;
}

.app__subtitle {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: 14px;
}

.app__main {
  display: flex;
  flex-direction: column;
}
</style>
