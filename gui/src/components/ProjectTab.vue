<script setup lang="ts">
  import { Icon } from '@iconify/vue'

  import IconBadge from '@/components/base/IconBadge.vue'
  import PanelHeader from '@/components/base/PanelHeader.vue'
  import type { CommandRequest, ProjectInfo } from '@/types'

  const props = defineProps<{
    info: ProjectInfo | null
    busy: boolean
  }>()

  const emit = defineEmits<{
    (event: 'run', command: CommandRequest): void
  }>()

  function runScript(script: string): void {
    emit('run', {
      label: `Run script: ${script}`,
      args: [ 'run', script ],
    })
  }
</script>

<template>
  <section v-if="props.info" class="project-tab">
    <div class="split-grid">
      <section class="panel">
        <PanelHeader
          icon="solar:info-circle-bold-duotone"
          title="Project Metadata"
        />
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
        <PanelHeader
          icon="solar:file-bold-duotone"
          title="Workspace Health"
        />
        <div class="chip-list health-grid">
          <IconBadge
            icon="solar:code-file-bold-duotone"
            :tone="props.info.hasPackageTs ? 'default' : 'warning'"
          >
            package.ts {{ props.info.hasPackageTs ? 'present' : 'missing' }}
          </IconBadge>
          <IconBadge
            icon="solar:file-text-bold-duotone"
            :tone="props.info.hasPackageJson ? 'default' : 'warning'"
          >
            package.json {{ props.info.hasPackageJson ? 'present' : 'missing' }}
          </IconBadge>
          <IconBadge
            icon="solar:lock-keyhole-bold-duotone"
            :tone="props.info.lockfiles.length === 0 ? 'warning' : 'default'"
          >
            {{ props.info.lockfiles.length }} lockfiles
          </IconBadge>
        </div>
        <div class="chip-list">
          <IconBadge
            v-for="lockfile in props.info.lockfiles"
            :key="lockfile"
            icon="solar:database-bold-duotone"
          >
            {{ lockfile }}
          </IconBadge>
          <span v-if="props.info.lockfiles.length === 0" class="muted">
            No lockfiles detected.
          </span>
        </div>
      </section>
    </div>

    <section class="panel">
      <PanelHeader icon="solar:play-circle-bold-duotone" title="Scripts">
        <IconBadge>{{ props.info.scripts.length }}</IconBadge>
      </PanelHeader>
      <div v-if="props.info.scripts.length === 0" class="muted">
        No scripts found in package.json.
      </div>
      <div v-else class="scripts-grid">
        <button
          v-for="script in props.info.scripts"
          :key="script"
          class="btn btn--ghost btn--tiny script-btn"
          type="button"
          :disabled="props.busy"
          @click="runScript(script)"
        >
          <Icon icon="solar:play-circle-bold-duotone" />
          <span>{{ script }}</span>
        </button>
      </div>
    </section>
  </section>
  <section v-else class="empty-card">
    <Icon icon="solar:danger-triangle-bold-duotone" width="42" height="42" />
    <p>Project information is unavailable.</p>
  </section>
</template>

<style scoped lang="sass">
  @use '@/styles/tokens' as *

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

  .health-grid
    margin-bottom: 10px

  .scripts-grid
    display: grid
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))
    gap: 8px

  .script-btn
    justify-content: flex-start
</style>
