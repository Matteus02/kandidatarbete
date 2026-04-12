<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <g>
    <polyline
      points="-30,0 -25,0 -20,-10 -10,10 0,-10 10,10 20,-10 25,0 30,0"
      fill="none" stroke="#e74c3c" stroke-width="2"
    />
    <text x="0" y="-16" text-anchor="middle" font-size="11" fill="#666">{{ label }}</text>
  </g>
</template>
