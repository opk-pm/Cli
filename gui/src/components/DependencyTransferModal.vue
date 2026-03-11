<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed, ref, watch } from 'vue'

  import IconBadge from '@/components/base/IconBadge.vue'
  import type { DependencyTransferRequest } from '@/types'
  import { pathLeaf } from '@/utils/path'

  const props = defineProps<{
    modelValue: boolean
    transfer: DependencyTransferRequest | null
  }>()

  const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'confirm', strategy: 'same' | 'latest'): void
  }>()

  const strategy = ref<'same' | 'latest'>('same')

  const targetScopeLabel = computed(() => {
    if (!props.transfer) return 'DEPS'
    if (props.transfer.targetScope === 'dev') return 'DEV'
    if (props.transfer.targetScope === 'peer') return 'PEER'
    return 'DEPS'
  })

  watch(
    () => props.modelValue,
    isOpen => {
      if (isOpen) {
        strategy.value = 'same'
      }
    }
  )

  function close(): void {
    emit('update:modelValue', false)
  }

  function confirm(): void {
    emit('confirm', strategy.value)
  }
</script>

<template>
  <Teleport to="body">
    <div
      v-if="props.modelValue && props.transfer"
      class="modal-wrap"
      @click.self="close"
    >
      <section class="modal-panel">
        <header class="modal-panel__header">
          <h2>
            <Icon icon="solar:transfer-horizontal-bold-duotone" />
            <span>Transfer Dependency</span>
          </h2>
        </header>

        <div class="modal-panel__body">
          <div class="transfer-summary">
            <IconBadge icon="solar:box-bold-duotone">
              {{ props.transfer.dependency.name }}
            </IconBadge>
            <IconBadge>{{ props.transfer.dependency.version }}</IconBadge>
            <IconBadge icon="solar:folder-open-bold-duotone">
              from
              {{
                pathLeaf(props.transfer.dependency.sourceProjectPath, 'project')
              }}
            </IconBadge>
            <IconBadge icon="solar:folder-with-files-bold-duotone">
              to
              {{ pathLeaf(props.transfer.targetProjectPath, 'project') }}
            </IconBadge>
            <IconBadge
              icon="solar:layers-minimalistic-bold-duotone"
              tone="warning"
            >
              {{ targetScopeLabel }}
            </IconBadge>
          </div>

          <div class="strategy-grid">
            <label class="strategy-option">
              <input v-model="strategy" type="radio" value="same" />
              <span>
                Use source version
                <strong>{{ props.transfer.dependency.version }}</strong>
              </span>
            </label>

            <label class="strategy-option">
              <input v-model="strategy" type="radio" value="latest" />
              <span>Use latest available version</span>
            </label>
          </div>
        </div>

        <footer class="modal-panel__footer">
          <button type="button" class="btn btn--ghost" @click="close">
            Cancel
          </button>
          <button type="button" class="btn btn--primary" @click="confirm">
            <Icon icon="solar:check-circle-bold-duotone" />
            <span>Add Dependency</span>
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<style scoped lang="sass">
  @use '@/styles/tokens' as *
  @use '@/styles/mixins' as *

  .modal-wrap
    position: fixed
    inset: 0
    z-index: 1100
    background: $surface-modal-backdrop
    display: grid
    place-items: center
    padding: 20px

  .modal-panel
    width: min(640px, 100%)
    +card-surface
    display: grid
    grid-template-rows: auto minmax(0, 1fr) auto
    overflow: hidden

  .modal-panel__header
    padding: 0.75rem
    border-bottom: 1px solid $line-soft
    h2
      margin: 0
      display: inline-flex
      align-items: center
      gap: 8px
      font-size: 1rem

  .modal-panel__body
    padding: 14px
    display: grid
    gap: 12px

  .transfer-summary
    display: flex
    gap: 8px
    flex-wrap: wrap

  .strategy-grid
    display: grid
    gap: 8px

  .strategy-option
    border: 1px solid $line-soft
    border-radius: $radius-sm
    background: $surface-overlay-soft
    min-height: 44px
    display: flex
    align-items: center
    gap: 10px
    padding: 0 12px
    cursor: pointer
    transition: 0.2s ease
    &:hover
      border-color: $line-card-strong

    input
      accent-color: $accent

    strong
      color: $text-primary

  .modal-panel__footer
    border-top: 1px solid $line-soft
    padding: 0.75rem
    display: flex
    justify-content: flex-end
    gap: 10px
</style>
