<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed } from 'vue'

  import type { ProjectInfo } from '@/types'

  const props = defineProps<{
    projectPath: string | null
    info: ProjectInfo | null
    loading: boolean
  }>()

  const totalDependencies = computed(() => {
    if (!props.info) return 0
    const counts = props.info.dependencyCounts
    return (
      counts.dependencies +
      counts.devDependencies +
      counts.peerDependencies +
      counts.optionalDependencies
    )
  })
</script>

<template>
  <header class="status-bar">
    <div class="status-bar__project">
      <Icon icon="solar:folder-path-connect-bold-duotone" />
      <span class="status-bar__name">
        {{ props.info?.name ?? 'No project selected' }}
      </span>
      <span v-if="props.info?.version" class="badge"
        >v{{ props.info.version }}</span
      >
    </div>

    <div class="status-bar__meta">
      <span class="badge">
        <Icon icon="solar:cpu-bolt-bold-duotone" />
        {{ props.info?.packageManager ?? 'Unknown PM' }}
      </span>
      <span class="badge">
        <Icon icon="solar:box-bold-duotone" />
        {{ totalDependencies }} deps
      </span>
      <span class="badge">
        <Icon icon="solar:filter-bold-duotone" />
        {{ props.info?.altPms.length ?? 0 }} alt PMs
      </span>
      <span
        class="badge"
        :class="{ 'badge--warning': (props.info?.lockfiles.length ?? 0) === 0 }"
      >
        <Icon icon="solar:lock-keyhole-bold-duotone" />
        {{ props.info?.lockfiles.length ?? 0 }} lockfiles
      </span>
      <span v-if="props.loading" class="badge badge--success">
        <Icon icon="solar:refresh-bold-duotone" />
        Syncing view
      </span>
    </div>
  </header>
</template>

<style scoped lang="sass">
  @use '@/styles/tokens' as *

  .status-bar
    min-height: 58px
    border-bottom: 1px solid $line-soft
    display: flex
    flex-wrap: wrap
    justify-content: space-between
    align-items: center
    gap: 10px
    padding: 10px 16px
    background: rgba(10, 16, 28, 0.82)
    backdrop-filter: blur(8px)

  .status-bar__project
    min-width: 0
    display: inline-flex
    align-items: center
    gap: 10px
    color: $text-secondary

  .status-bar__name
    color: $text-primary
    font-weight: 600
    max-width: min(480px, 55vw)
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  .status-bar__meta
    display: inline-flex
    align-items: center
    gap: 8px
    flex-wrap: wrap
</style>
