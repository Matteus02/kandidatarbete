<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <g>
    <line x1="-30" y1="0" x2="-6" y2="0" stroke="#3498db" stroke-width="2"/>
    <line x1="-6" y1="-12" x2="-6" y2="12" stroke="#3498db" stroke-width="2"/>
    <line x1="6" y1="-12" x2="6" y2="12" stroke="#3498db" stroke-width="2"/>
    <line x1="6" y1="0" x2="30" y2="0" stroke="#3498db" stroke-width="2"/>
    <text x="0" y="24" text-anchor="middle" font-size="11" fill="#666">{{ label }}</text>
  </g>
</template>
