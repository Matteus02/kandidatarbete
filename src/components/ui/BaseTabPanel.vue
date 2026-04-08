<script setup lang="ts">
import { computed, inject } from 'vue'
import { ActiveTabKey } from './tabsContext'

interface Props {
  tabId: string
}

const props = defineProps<Props>()

const activeTab = inject(ActiveTabKey)

const isActive = computed(() => activeTab?.value === props.tabId)
</script>

<template>
  <div v-if="isActive" role="tabpanel">
    <slot />
  </div>
</template>
