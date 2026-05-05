<script setup lang="ts">
const version = '1.0.0 beta'
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <div class="app-header__logo">
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          <!-- White background for the circle -->
          <circle cx="20" cy="20" r="18" fill="white" />

          <!-- Border: 3/4 Black part -->
          <path
            d="M20 38 A18 18 0 1 1 38 20"
            stroke="black"
            stroke-width="2.5"
            fill="none"
          />
          <!-- Border: 1/4 Gray part (Bottom-Right) -->
          <path
            d="M38 20 A18 18 0 0 1 20 38"
            stroke="#94a3b8"
            stroke-width="2.5"
            fill="none"
          />

          <!-- Resistor Zigzag inside: Connects each side -->
          <path
            d="M2 20 L10 20 L13 14 L17 26 L21 14 L25 26 L29 20 L38 20"
            stroke="black"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>

      <div class="app-header__title-group">
        <h1 class="app-header__title">SPECTRA</h1>
        <span class="app-header__version">v{{ version }}</span>
      </div>
    </div>

    <p class="app-header__subtitle">Electrochemical Impedance Spectroscopy Analyzer</p>
  </header>
</template>

<style scoped>
.app-header {
  padding: 12px 24px;
  background: white;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app-header__logo {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
}

.app-header__title-group {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.app-header__title {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #0f172a;
  margin: 0;
}

.app-header__version {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.app-header__subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 600;
  margin-left: auto;
}

@media (max-width: 768px) {
  .app-header__subtitle {
    display: none;
  }
}
</style>
