<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <g>
    <polyline
      points="0,0 5,0 10,-10 20,10 30,-10 40,10 50,-10 55,0 60,0"
      fill="none" stroke="#e74c3c" stroke-width="2"
    />
    <text x="30" y="-16" text-anchor="middle" font-size="11" fill="#666">{{ label }}</text>
  </g>
</template>
