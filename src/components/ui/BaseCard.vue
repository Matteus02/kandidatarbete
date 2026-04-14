<script setup lang="ts">
interface Props {
  title?: string
}

defineProps<Props>()
</script>

<template>
  <section class="card">
    <header v-if="$slots.header || title" class="card__header">
      <slot name="header">
        <h2 class="card__title">{{ title }}</h2>
      </slot>
    </header>

    <div class="card__body">
      <slot />
    </div>

    <footer v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </footer>
  </section>
</template>

<style scoped>
.card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  display: flex;
  flex-direction: column;
}

.card__header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid var(--color-border);
}

.card__title {
  font-size: 16px;
  font-weight: 600;
}

.card__body {
  padding: var(--space-4);
  flex: 1;
}

.card__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
}
</style>
