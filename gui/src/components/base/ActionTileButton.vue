<script setup lang="ts">
  import { Icon } from '@iconify/vue'

  const props = defineProps<{
    icon: string
    label: string
    disabled?: boolean
  }>()

  const emit = defineEmits<{
    (event: 'click'): void
  }>()
</script>

<template>
  <button
    class="btn btn--ghost action-tile-btn"
    type="button"
    :disabled="props.disabled"
    @click="emit('click')"
  >
    <Icon :icon="props.icon" />
    <span>{{ props.label }}</span>
  </button>
</template>

<style scoped lang="sass">
  .action-tile-btn
    justify-content: flex-start
    min-height: 40px
</style>
