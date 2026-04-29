<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <g>
    <rect x="2" y="-12" width="60" height="24" fill="white" stroke="#27ae60" stroke-width="2" rx="3"/>
    <text x="30" y="5" text-anchor="middle" font-size="11" font-weight="bold" fill="#27ae60">Ws</text>
    <text x="30" y="22" text-anchor="middle" font-size="11" fill="#666">{{ label }}</text>
  </g>
</template>
