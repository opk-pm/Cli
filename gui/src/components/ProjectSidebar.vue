<script setup lang="ts">
  import { Icon } from '@iconify/vue'

  import { pathLeaf } from '@/utils/path'
  import type { ProjectRecord } from '@/types'

  const props = defineProps<{
    projects: ProjectRecord[]
    selectedPath: string | null
    activeSection: 'projects' | 'registry'
    loading: boolean
  }>()

  const emit = defineEmits<{
    (event: 'select', path: string): void
    (event: 'add'): void
    (event: 'remove', path: string): void
    (event: 'change-section', section: 'projects' | 'registry'): void
  }>()

</script>

<template>
  <aside class="sidebar">
    <header class="sidebar__head">
      <div class="sidebar__branding">
        <span class="sidebar__logo">
          <img src="/opk-gui-icon.png" alt="Opk GUI Icon" />
        </span>
        <div>
          <h1 class="sidebar__title">Opk GUI</h1>
          <p class="sidebar__subtitle">Project Workspace</p>
        </div>
      </div>

      <div class="sidebar__actions">
        <div class="sidebar__section-tabs">
          <button
            class="section-tab"
            :class="{
              'section-tab--active': props.activeSection === 'projects',
            }"
            type="button"
            @click="emit('change-section', 'projects')"
          >
            <Icon icon="solar:folder-open-bold-duotone" />
            <span>Projects</span>
          </button>
          <button
            class="section-tab"
            :class="{
              'section-tab--active': props.activeSection === 'registry',
            }"
            type="button"
            @click="emit('change-section', 'registry')"
          >
            <Icon icon="solar:archive-bold-duotone" />
            <span>Registry</span>
          </button>
        </div>
        <button
          v-if="props.activeSection === 'projects'"
          class="btn btn--primary btn--tiny"
          type="button"
          @click="emit('add')"
        >
          <Icon icon="solar:add-circle-bold-duotone" />
          <span>Add</span>
        </button>
      </div>
    </header>

    <div class="sidebar__list scroll-area">
      <template
        v-if="props.activeSection === 'projects' && props.projects.length > 0"
      >
        <div
          v-for="project in props.projects"
          :key="project.path"
          class="project-item"
          :class="{
            'project-item--active': project.path === props.selectedPath,
          }"
          type="button"
          @click="emit('select', project.path)"
        >
          <span class="project-item__main">
            <Icon icon="solar:folder-with-files-bold-duotone" />
            <span class="project-item__name">{{
              pathLeaf(project.path, project.path)
            }}</span>
          </span>

          <button
            class="project-item__remove"
            type="button"
            aria-label="Remove project"
            @click.stop="emit('remove', project.path)"
          >
            <Icon icon="solar:trash-bin-trash-bold-duotone" />
          </button>
        </div>
      </template>

      <div
        v-else-if="props.activeSection === 'projects'"
        class="sidebar__empty"
      >
        <Icon icon="solar:folder-open-bold-duotone" />
        <p>No saved projects yet.</p>
      </div>

      <div v-else class="sidebar__empty">
        <Icon icon="solar:archive-bold-duotone" />
        <p>Browse npm registry and add packages to any saved project.</p>
      </div>
    </div>

    <footer class="sidebar__footer">
      <span class="muted">
        {{
          props.loading
            ? 'Refreshing projects…'
            : props.activeSection === 'projects'
              ? `${props.projects.length} project(s)`
              : 'Registry explorer'
        }}
      </span>
    </footer>
  </aside>
</template>

<style scoped lang="sass">
  @use '@/styles/tokens' as *

  .sidebar
    display: grid
    grid-template-rows: auto minmax(0, 1fr) auto
    min-height: 0
    height: 100%
    overflow: hidden

  .sidebar__head
    padding: 0.75rem
    border-bottom: 1px solid $line-soft
    display: grid
    gap: 10px

  .sidebar__branding
    display: flex
    gap: 10px
    align-items: center

  .sidebar__logo
    width: 34px
    height: 34px
    display: grid
    place-items: center
    border-radius: 10px
    color: $accent
    background: $accent-bg-logo
    border: 1px solid $accent-bg-strong

    img
      width: 24px
      height: 24px

  .sidebar__title
    margin: 0
    font-size: 1rem

  .sidebar__subtitle
    margin: 0
    color: $text-muted
    font-size: 0.78rem

  .sidebar__actions
    display: grid
    gap: 8px

  .sidebar__section-tabs
    display: grid
    grid-template-columns: repeat(2, minmax(0, 1fr))
    gap: 8px

  .section-tab
    border: 1px solid $line-white-soft
    background: $surface-overlay
    color: $text-secondary
    min-height: 32px
    border-radius: $radius-md
    display: inline-flex
    align-items: center
    justify-content: center
    gap: 6px
    cursor: pointer
    transition: 0.18s ease
    &:hover
      border-color: $line-card-strong

  .section-tab--active
    color: $text-primary
    border-color: $accent-border
    background: $accent-bg

  .sidebar__list
    padding: 0.75rem
    min-height: 0

  .project-item
    width: 100%
    border: 1px solid transparent
    border-radius: $radius-md
    background: transparent
    color: $text-secondary
    display: flex
    align-items: center
    justify-content: space-between
    gap: 0.5rem
    padding: 0.5rem 0.75rem
    margin-bottom: 0.25rem
    cursor: pointer
    transition: 0.2s ease

    &:hover
      background: $surface-overlay-strong
      border-color: $line-muted

    &:hover .project-item__remove
      opacity: 1

  .project-item--active
    color: $text-primary
    border-color: $accent-border-soft
    background: linear-gradient(180deg, $accent-gradient-item-start, $accent-gradient-item-end)

  .project-item__main
    display: inline-flex
    align-items: center
    gap: 8px
    min-width: 0

  .project-item__name
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  .project-item__remove
    border: 0
    width: 24px
    height: 24px
    border-radius: 7px
    display: flex
    justify-content: center
    align-items: center
    background: $danger-bg
    color: $text-danger-muted
    opacity: 0.1
    cursor: pointer
    transition: 0.2s ease
    &:hover
      opacity: 1

  .sidebar__empty
    display: flex
    flex-direction: column
    min-height: 220px
    gap: 1rem
    text-align: center
    justify-content: center
    align-items: center
    color: $text-muted
    border: 1px dashed $line-card-dashed
    border-radius: $radius-md
    background: $surface-overlay-soft

    svg
      width: 4rem
      height: 4rem

  .sidebar__footer
    border-top: 1px solid $line-soft
    padding: 0.75rem
    font-size: 0.78rem
</style>
