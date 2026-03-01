<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed, ref } from 'vue'
  import type { CommandRequest } from '@/types'

  const props = defineProps<{
    projectPath: string | null
    busy: boolean
  }>()

  const emit = defineEmits<{
    (event: 'run', command: CommandRequest): void
  }>()

  const customCommand = ref('')

  const quickButtons = computed(() => [
    {
      label: 'Install',
      icon: 'solar:download-bold-duotone',
      args: ['install'],
    },
    {
      label: 'Update',
      icon: 'solar:refresh-bold-duotone',
      args: ['update'],
    },
    {
      label: 'Audit',
      icon: 'solar:shield-check-bold-duotone',
      args: ['audit'],
    },
    {
      label: 'Sync',
      icon: 'solar:repeat-one-bold-duotone',
      args: ['sync'],
    },
    {
      label: 'Generate',
      icon: 'solar:file-text-bold-duotone',
      args: ['generate'],
    },
    {
      label: 'Migrate',
      icon: 'solar:transfer-horizontal-bold-duotone',
      args: ['migrate'],
    },
  ])

  function projectNameFromPath(path: string | null): string {
    if (!path) return 'my-project'
    const normalized = path.replace(/\\/g, '/')
    const parts = normalized.split('/').filter(Boolean)
    return parts[parts.length - 1] ?? 'my-project'
  }

  function runInitDefault(): void {
    const name = projectNameFromPath(props.projectPath)
    emit('run', {
      label: 'Initialize project',
      args: ['init'],
      stdin: `${name}\nManaged with Opk GUI\nMIT\nmodule\n`,
    })
  }

  function runQuickAction(command: CommandRequest): void {
    emit('run', command)
  }

  function runCustomCommand(): void {
    const args = customCommand.value.trim().split(/\s+/).filter(Boolean)
    if (args.length === 0) return
    emit('run', {
      label: `Custom: ${args[0]}`,
      args,
    })
    customCommand.value = ''
  }
</script>

<template>
  <section class="panel">
    <div class="title-row">
      <h3 class="title-row__heading">
        <Icon icon="solar:flash-circle-bold-duotone" />
        <span>Quick Actions</span>
      </h3>
      <button
        class="btn btn--primary btn--tiny"
        type="button"
        :disabled="props.busy || !props.projectPath"
        @click="runInitDefault"
      >
        <Icon icon="solar:magic-stick-2-bold-duotone" />
        <span>Init with defaults</span>
      </button>
    </div>

    <div class="actions-grid">
      <button
        v-for="button in quickButtons"
        :key="button.label"
        class="btn btn--ghost action-btn"
        type="button"
        :disabled="props.busy || !props.projectPath"
        @click="runQuickAction({ label: button.label, args: button.args })"
      >
        <Icon :icon="button.icon" />
        <span>{{ button.label }}</span>
      </button>
    </div>

    <div class="custom-command">
      <label class="field">
        <span class="field__label"
          >Custom opk command (without leading `opk`)</span
        >
        <input
          v-model="customCommand"
          class="field__input"
          type="text"
          placeholder="add vue --dev"
          :disabled="props.busy || !props.projectPath"
          @keydown.enter.prevent="runCustomCommand"
        />
      </label>
      <button
        class="btn btn--primary"
        type="button"
        :disabled="props.busy || !props.projectPath || !customCommand.trim()"
        @click="runCustomCommand"
      >
        <Icon icon="solar:play-circle-bold-duotone" />
        <span>Run</span>
      </button>
    </div>
  </section>
</template>

<style scoped lang="sass">
  .actions-grid
    display: grid
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))
    gap: 10px

  .action-btn
    justify-content: flex-start
    min-height: 40px

  .custom-command
    margin-top: 12px
    display: grid
    grid-template-columns: minmax(0, 1fr) auto
    gap: 10px
    align-items: end

  @media (max-width: 760px)
    .custom-command
      grid-template-columns: 1fr
</style>
