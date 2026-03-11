<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed } from 'vue'

  type BadgeTone = 'default' | 'success' | 'warning' | 'danger'

  const props = withDefaults(
    defineProps<{
      icon?: string
      tone?: BadgeTone
    }>(),
    {
      tone: 'default',
    }
  )

  const toneClass = computed(() => {
    if (props.tone === 'success') return 'badge--success'
    if (props.tone === 'warning') return 'badge--warning'
    if (props.tone === 'danger') return 'badge--danger'
    return ''
  })
</script>

<template>
  <span class="badge" :class="toneClass">
    <Icon v-if="props.icon" :icon="props.icon" />
    <slot />
  </span>
</template>
