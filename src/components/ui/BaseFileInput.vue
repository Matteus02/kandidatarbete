<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  accept?: string
  label?: string
  multiple?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  accept: undefined,
  label: 'Choose file',
  multiple: false,
})

const emit = defineEmits<{
  (e: 'change', files: File | File[] | null): void
}>()

const inputRef = ref<HTMLInputElement | null>(null)

function onChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) {
    emit('change', null)
    return
  }
  if (props.multiple) {
    emit('change', Array.from(files))
  } else {
    emit('change', files[0] ?? null)
  }
}

function open(): void {
  inputRef.value?.click()
}
</script>

<template>
  <div class="file-input">
    <button type="button" class="file-input__btn" @click="open">
      {{ props.label }}
    </button>
    <input
      ref="inputRef"
      type="file"
      class="file-input__native"
      :accept="props.accept"
      :multiple="props.multiple"
      @change="onChange"
    />
  </div>
</template>

<style scoped>
.file-input {
  display: inline-block;
}

.file-input__native {
  display: none;
}

.file-input__btn {
  display: inline-flex;
  align-items: center;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius);
  background: var(--color-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}

.file-input__btn:hover {
  background: var(--color-primary-hover);
}
</style>
