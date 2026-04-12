<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'

</script>

<template>
  <BaseCard title="Circuit Model">
<div class="controls">
      <p>Adjust parameters to fit the curve!</p>
    </div>
    <div id="circuit-comparison-plot"></div>  </BaseCard>
</template>

<style scoped>
.placeholder {
  color: var(--color-text-muted);
  margin: 0;
}
</style>
