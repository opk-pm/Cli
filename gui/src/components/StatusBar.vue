<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed } from 'vue'

  import IconBadge from '@/components/base/IconBadge.vue'
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
      <IconBadge v-if="props.info?.version"
        >v{{ props.info.version }}</IconBadge
      >
    </div>

    <div class="status-bar__meta">
      <IconBadge icon="solar:cpu-bolt-bold-duotone">
        {{ props.info?.packageManager ?? 'Unknown PM' }}
      </IconBadge>
      <IconBadge icon="solar:box-bold-duotone">
        {{ totalDependencies }} deps
      </IconBadge>
      <IconBadge icon="solar:filter-bold-duotone">
        {{ props.info?.altPms.length ?? 0 }} alt PMs
      </IconBadge>
      <IconBadge
        icon="solar:lock-keyhole-bold-duotone"
        :tone="
          (props.info?.lockfiles.length ?? 0) === 0 ? 'warning' : 'default'
        "
      >
        {{ props.info?.lockfiles.length ?? 0 }} lockfiles
      </IconBadge>
      <IconBadge
        v-if="props.loading"
        icon="solar:refresh-bold-duotone"
        tone="success"
      >
        Syncing view
      </IconBadge>
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
    background: $surface-status
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
