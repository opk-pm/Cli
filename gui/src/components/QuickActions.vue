<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { ref } from 'vue'

  import ActionTileButton from '@/components/base/ActionTileButton.vue'
  import PanelHeader from '@/components/base/PanelHeader.vue'
  import { pathLeaf } from '@/utils/path'
  import type { CommandRequest } from '@/types'

  const props = defineProps<{
    projectPath: string | null
    busy: boolean
  }>()

  const emit = defineEmits<{
    (event: 'run', command: CommandRequest): void
  }>()

  const customCommand = ref('')

  interface QuickButton {
    label: string
    icon: string
    args: string[]
  }

  const quickButtons: QuickButton[] = [
    {
      label: 'Install',
      icon: 'solar:download-bold-duotone',
      args: [ 'install' ],
    },
    {
      label: 'Update',
      icon: 'solar:refresh-bold-duotone',
      args: [ 'update' ],
    },
    {
      label: 'Audit',
      icon: 'solar:shield-check-bold-duotone',
      args: [ 'audit' ],
    },
    {
      label: 'Sync',
      icon: 'solar:repeat-one-bold-duotone',
      args: [ 'sync' ],
    },
    {
      label: 'Generate',
      icon: 'solar:file-text-bold-duotone',
      args: [ 'generate' ],
    },
    {
      label: 'Migrate',
      icon: 'solar:transfer-horizontal-bold-duotone',
      args: [ 'migrate' ],
    },
    {
      label: 'List',
      icon: 'solar:list-bold-duotone',
      args: [ 'list' ],
    },
    {
      label: 'Outdated',
      icon: 'solar:sort-by-time-bold-duotone',
      args: [ 'outdated', '--list' ],
    },
  ]

  function runInitDefault(): void {
    const name = pathLeaf(props.projectPath, 'my-project')
    emit('run', {
      label: 'Initialize project',
      args: [ 'init' ],
      stdin: `${name}\nManaged with Opk GUI\nMIT\nmodule\n`,
    })
  }

  function runQuickAction(button: QuickButton): void {
    emit('run', {
      label: button.label,
      args: button.args,
    })
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
    <PanelHeader
      icon="solar:flash-circle-bold-duotone"
      title="Quick Actions"
    >
      <button
        class="btn btn--primary btn--tiny"
        type="button"
        :disabled="props.busy || !props.projectPath"
        @click="runInitDefault"
      >
        <Icon icon="solar:magic-stick-2-bold-duotone" />
        <span>Init with defaults</span>
      </button>
    </PanelHeader>

    <div class="actions-grid">
      <ActionTileButton
        v-for="button in quickButtons"
        :key="button.label"
        :icon="button.icon"
        :label="button.label"
        :disabled="props.busy || !props.projectPath"
        @click="runQuickAction(button)"
      />
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
