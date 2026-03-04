<script setup lang="ts">
  import { Icon } from '@iconify/vue'

  export interface NavigationTab {
    id: string
    label: string
    icon: string
  }

  const props = defineProps<{
    modelValue: string
    tabs: NavigationTab[]
  }>()

  const emit = defineEmits<{
    (event: 'update:modelValue', value: string): void
  }>()

  function setTab(tabId: string) {
    emit('update:modelValue', tabId)
  }
</script>

<template>
  <nav class="tabs-wrap">
    <button
      v-for="tab in props.tabs"
      :key="tab.id"
      class="tab-btn"
      :class="{ 'tab-btn--active': tab.id === props.modelValue }"
      type="button"
      @click="setTab(tab.id)"
    >
      <Icon :icon="tab.icon" />
      <span>{{ tab.label }}</span>
    </button>
  </nav>
</template>

<style scoped lang="sass">
  @use '@/styles/tokens' as *

  .tabs-wrap
    display: flex
    gap: 8px
    flex-wrap: wrap

  .tab-btn
    border: 1px solid rgb(208 170 255 / 0.16)
    background: rgba(255, 255, 255, 0.03)
    color: $text-secondary
    border-radius: 999px
    padding: 7px 14px
    min-height: 36px
    display: inline-flex
    align-items: center
    gap: 8px
    cursor: pointer
    transition: 0.2s ease
    &:hover
      border-color: rgba(170, 192, 255, 0.36)
      color: $text-primary

  .tab-btn--active
    border-color: rgb(171 123 255 / 0.42)
    background: linear-gradient(180deg, rgb(169 112 255 / 0.24), rgb(140 84 224 / 0.18))
    color: $text-primary
</style>
