<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <g>
    <rect x="-28" y="-12" width="56" height="24" fill="white" stroke="#1abc9c" stroke-width="2" rx="3"/>
    <text x="0" y="5" text-anchor="middle" font-size="12" font-weight="bold" fill="#1abc9c">W</text>
    <text x="0" y="22" text-anchor="middle" font-size="11" fill="#666">{{ label }}</text>
  </g>
</template>
