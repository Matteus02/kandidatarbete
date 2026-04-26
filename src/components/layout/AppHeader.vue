<script setup lang="ts">
</script>

<template>
  <header class="app-header">
    <h1 class="app-header__title">SPECTRA</h1>
    <p class="app-header__subtitle">Electrochemical Impedance Spectroscopy Analyzer</p>
  </header>
</template>

<style scoped>
.app-header {
  padding: var(--space-2) var(--space-4);
  background: white;
  border-bottom: 1px solid #eee;
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
}

.app-header__title {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #1a1a1a;
}

.app-header__subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-weight: 500;
}
</style>
