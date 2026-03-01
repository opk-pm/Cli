<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import type { ProjectInfo } from '@/types'

  const props = defineProps<{
    info: ProjectInfo | null
  }>()
</script>

<template>
  <section v-if="props.info" class="project-tab">
    <div class="split-grid">
      <section class="panel">
        <h3 class="panel-title">
          <Icon icon="solar:info-circle-bold-duotone" />
          <span>Project Metadata</span>
        </h3>
        <dl class="meta-grid">
          <dt>Name</dt>
          <dd>{{ props.info.name }}</dd>
          <dt>Version</dt>
          <dd>{{ props.info.version ?? 'n/a' }}</dd>
          <dt>Description</dt>
          <dd>{{ props.info.description ?? 'n/a' }}</dd>
          <dt>Path</dt>
          <dd class="meta-grid__path">{{ props.info.path }}</dd>
          <dt>Primary PM</dt>
          <dd>{{ props.info.packageManager }}</dd>
          <dt>Alt PMs</dt>
          <dd>
            {{
              props.info.altPms.length > 0
                ? props.info.altPms.join(', ')
                : 'none'
            }}
          </dd>
        </dl>
      </section>

      <section class="panel">
        <h3 class="panel-title">
          <Icon icon="solar:file-bold-duotone" />
          <span>Workspace Health</span>
        </h3>
        <div class="chips-wrap">
          <span
            class="badge"
            :class="{ 'badge--warning': !props.info.hasPackageTs }"
          >
            <Icon icon="solar:code-file-bold-duotone" />
            package.ts {{ props.info.hasPackageTs ? 'present' : 'missing' }}
          </span>
          <span
            class="badge"
            :class="{ 'badge--warning': !props.info.hasPackageJson }"
          >
            <Icon icon="solar:file-text-bold-duotone" />
            package.json {{ props.info.hasPackageJson ? 'present' : 'missing' }}
          </span>
          <span
            class="badge"
            :class="{ 'badge--warning': props.info.lockfiles.length === 0 }"
          >
            <Icon icon="solar:lock-keyhole-bold-duotone" />
            {{ props.info.lockfiles.length }} lockfiles
          </span>
        </div>
        <div class="lockfiles-list">
          <span
            v-for="lockfile in props.info.lockfiles"
            :key="lockfile"
            class="badge"
          >
            <Icon icon="solar:database-bold-duotone" />
            {{ lockfile }}
          </span>
          <span v-if="props.info.lockfiles.length === 0" class="muted">
            No lockfiles detected.
          </span>
        </div>
      </section>
    </div>

    <section class="panel">
      <h3 class="panel-title">
        <Icon icon="solar:play-circle-bold-duotone" />
        <span>Scripts</span>
      </h3>
      <div v-if="props.info.scripts.length === 0" class="muted">
        No scripts found in package.json.
      </div>
      <div v-else class="scripts-grid">
        <span v-for="script in props.info.scripts" :key="script" class="badge">
          <Icon icon="solar:programming-bold-duotone" />
          {{ script }}
        </span>
      </div>
    </section>
  </section>
  <section v-else class="empty-card">
    <Icon icon="solar:danger-triangle-bold-duotone" width="42" height="42" />
    <p>Project information is unavailable.</p>
  </section>
</template>

<style scoped lang="sass">
  @use '../../styles/tokens' as *

  .project-tab
    display: grid
    gap: 12px

  .meta-grid
    display: grid
    grid-template-columns: 120px minmax(0, 1fr)
    gap: 8px 12px
    margin: 0
    dt
      color: $text-muted
    dd
      margin: 0
      color: $text-primary

  .meta-grid__path
    overflow-wrap: anywhere

  .chips-wrap
    display: flex
    gap: 8px
    flex-wrap: wrap
    margin-bottom: 10px

  .lockfiles-list
    display: flex
    gap: 8px
    flex-wrap: wrap

  .scripts-grid
    display: flex
    gap: 8px
    flex-wrap: wrap
</style>
