<script setup lang="ts">
  import { Icon } from '@iconify/vue'

  const props = defineProps<{
    icon: string
    title: string
  }>()
</script>

<template>
  <div class="title-row">
    <h3 class="title-row__heading">
      <Icon :icon="props.icon" />
      <span>{{ props.title }}</span>
    </h3>
    <slot />
  </div>
</template>
