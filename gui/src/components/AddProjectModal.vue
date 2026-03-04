<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed, ref, watch } from 'vue'

  import { addProject, getQuickLocations, listFolders } from '@/services/api'
  import type { FsEntry, ProjectRecord, QuickLocation, TreeNode } from '@/types'

  import FolderTreeNode from './FolderTreeNode.vue'

  const props = defineProps<{
    modelValue: boolean
  }>()

  const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'added', project: ProjectRecord): void
  }>()

  const quickLocations = ref<QuickLocation[]>([])
  const activeLocation = ref<string | null>(null)
  const rootNodes = ref<TreeNode[]>([])
  const selectedFolderPath = ref<string | null>(null)
  const loadingLocations = ref(false)
  const loadingTree = ref(false)
  const errorMessage = ref<string | null>(null)

  const canSubmit = computed(
    () =>
      !loadingLocations.value &&
      !loadingTree.value &&
      !!selectedFolderPath.value
  )

  watch(
    () => props.modelValue,
    value => {
      if (!value) return
      void initialize()
    }
  )

  async function initialize(): Promise<void> {
    errorMessage.value = null
    loadingLocations.value = true
    try {
      quickLocations.value = await getQuickLocations()
      const firstLocation = quickLocations.value[0]?.path ?? null
      activeLocation.value = firstLocation
      selectedFolderPath.value = firstLocation
      if (firstLocation) {
        await loadLocation(firstLocation)
      }
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : String(error)
    } finally {
      loadingLocations.value = false
    }
  }

  function close() {
    emit('update:modelValue', false)
  }

  function toNode(entry: FsEntry): TreeNode {
    return {
      ...entry,
      expanded: false,
      loading: false,
      loaded: false,
      children: [],
    }
  }

  async function loadLocation(path: string): Promise<void> {
    loadingTree.value = true
    errorMessage.value = null
    try {
      const entries = await listFolders(path)
      rootNodes.value = entries.filter(entry => entry.isDirectory).map(toNode)
      selectedFolderPath.value = path
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : String(error)
    } finally {
      loadingTree.value = false
    }
  }

  async function onPickLocation(path: string): Promise<void> {
    activeLocation.value = path
    await loadLocation(path)
  }

  async function onToggleNode(node: TreeNode): Promise<void> {
    if (!node.isDirectory) return
    node.expanded = !node.expanded
    if (!node.expanded || node.loaded) return

    node.loading = true
    try {
      const entries = await listFolders(node.path)
      node.children = entries.filter(entry => entry.isDirectory).map(toNode)
      node.loaded = true
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : String(error)
    } finally {
      node.loading = false
    }
  }

  function onSelectNode(node: TreeNode): void {
    selectedFolderPath.value = node.path
  }

  async function addSelectedProject(): Promise<void> {
    if (!selectedFolderPath.value) return
    loadingTree.value = true
    errorMessage.value = null
    try {
      const project = await addProject(selectedFolderPath.value)
      emit('added', project)
      close()
    } catch (error) {
      errorMessage.value =
        error instanceof Error ? error.message : String(error)
    } finally {
      loadingTree.value = false
    }
  }
</script>

<template>
  <Teleport to="body">
    <div v-if="props.modelValue" class="modal-wrap" @click.self="close">
      <section class="modal-panel">
        <header class="modal-panel__header">
          <h2>
            <Icon icon="solar:add-folder-bold-duotone" />
            <span>Add Project</span>
          </h2>
        </header>

        <div class="modal-panel__body">
          <aside class="modal-panel__locations">
            <h3>Quick Locations</h3>
            <button
              v-for="location in quickLocations"
              :key="location.id"
              type="button"
              class="location-btn"
              :class="{
                'location-btn--active': location.path === activeLocation,
              }"
              @click="onPickLocation(location.path)"
            >
              <Icon :icon="location.icon" />
              <span>{{ location.name }}</span>
            </button>
          </aside>

          <section class="modal-panel__tree">
            <div class="modal-panel__path muted">
              {{ selectedFolderPath ?? 'Pick a folder to add' }}
            </div>
            <div class="tree-view scroll-area">
              <ul class="tree-root">
                <FolderTreeNode
                  v-for="node in rootNodes"
                  :key="node.path"
                  :node="node"
                  :selected-path="selectedFolderPath"
                  @toggle="onToggleNode"
                  @select="onSelectNode"
                />
              </ul>
            </div>
          </section>
        </div>

        <footer class="modal-panel__footer">
          <span v-if="errorMessage" class="badge badge--danger">{{
            errorMessage
          }}</span>
          <span v-else class="muted"
            >Choose any folder to manage with Opk GUI.</span
          >
          <div class="modal-panel__actions">
            <button type="button" class="btn btn--ghost" @click="close">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn--primary"
              :disabled="!canSubmit"
              @click="addSelectedProject"
            >
              <Icon icon="solar:check-circle-bold-duotone" />
              <span>Add Project</span>
            </button>
          </div>
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
    z-index: 1000
    background: rgba(4, 7, 14, 0.7)
    display: grid
    place-items: center
    padding: 20px

  .modal-panel
    width: min(980px, 100%)
    height: min(760px, 90vh)
    max-height: min(760px, 90vh)
    +card-surface
    display: grid
    grid-template-rows: auto minmax(0, 1fr) auto
    overflow: hidden

  .modal-panel__header
    padding: 0.75rem
    border-bottom: 1px solid $line-soft
    display: flex
    justify-content: space-between
    align-items: center
    h2
      margin: 0
      display: inline-flex
      align-items: center
      gap: 8px
      font-size: 1rem

  .modal-panel__body
    min-height: 0
    display: grid
    grid-template-columns: 220px minmax(0, 1fr)

  .modal-panel__locations
    border-right: 1px solid $line-soft
    padding: 12px
    display: flex
    flex-direction: column
    gap: 8px
    min-height: 0
    overflow: auto
    +soft-scrollbar
    h3
      margin: 0 0 6px
      font-size: 0.84rem
      color: $text-muted

  .location-btn
    border: 1px solid transparent
    border-radius: 9px
    background: transparent
    color: $text-secondary
    min-height: 34px
    padding: 0 10px
    display: flex
    align-items: center
    gap: 8px
    cursor: pointer
    text-align: left
    &:hover
      background: rgba(255, 255, 255, 0.04)
    &--active
      border-color: rgb(160 112 255 / 0.4)
      color: $text-primary
      background: rgb(164 112 255 / 0.16)

  .modal-panel__tree
    min-width: 0
    min-height: 0
    padding: 12px
    display: grid
    grid-template-rows: auto minmax(0, 1fr)
    gap: 8px

  .modal-panel__path
    font-size: 0.82rem
    border: 1px solid $line-soft
    border-radius: 8px
    background: rgba(255, 255, 255, 0.03)
    min-height: 34px
    display: flex
    align-items: center
    padding: 0 10px
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  .tree-view
    height: 100%
    min-height: 0
    overflow: auto
    border: 1px solid $line-soft
    border-radius: 12px
    padding: 8px
    background: rgba(7, 12, 22, 0.85)

  .tree-root
    margin: 0
    padding: 0

  .modal-panel__footer
    border-top: 1px solid $line-soft
    padding: 0.75rem
    display: flex
    justify-content: space-between
    align-items: center
    gap: 12px

  .modal-panel__actions
    display: inline-flex
    gap: 10px

  @media (max-width: 900px)
    .modal-panel__body
      grid-template-columns: 1fr
    .modal-panel__locations
      border-right: 0
      border-bottom: 1px solid $line-soft
</style>
