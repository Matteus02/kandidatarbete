<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <g>
    <!-- 4 upward bumps from x=5 to x=55 -->
    <path
      d="M 0,0 H 5 A 6.25,6.25 0 0,0 17.5,0 A 6.25,6.25 0 0,0 30,0 A 6.25,6.25 0 0,0 42.5,0 A 6.25,6.25 0 0,0 55,0 H 60"
      fill="none" stroke="#9b59b6" stroke-width="2"
    />
    <text x="30" y="20" text-anchor="middle" font-size="11" fill="#666">{{ label }}</text>
  </g>
</template>
