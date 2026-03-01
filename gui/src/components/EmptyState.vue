<script setup lang="ts">
  import { Icon } from '@iconify/vue'

  const props = defineProps<{
    hasProjects: boolean
  }>()

  const emit = defineEmits<{
    (event: 'add'): void
  }>()
</script>

<template>
  <section class="empty-card">
    <Icon
      :icon="
        props.hasProjects
          ? 'solar:folder-open-bold-duotone-duotone'
          : 'solar:folder-add-bold-duotone'
      "
      width="58"
      height="58"
    />
    <h2 class="empty-state__title">
      {{
        props.hasProjects
          ? 'Pick a project from the sidebar'
          : 'Welcome to Opk GUI'
      }}
    </h2>
    <p class="muted">
      {{
        props.hasProjects
          ? 'Select a project to inspect packages, lockfile graph, and run opk actions.'
          : 'Add a folder to begin managing dependencies, lockfiles, and project workflows.'
      }}
    </p>
    <button
      v-if="!props.hasProjects"
      class="btn btn--primary"
      type="button"
      @click="emit('add')"
    >
      <Icon icon="solar:add-circle-bold-duotone" />
      <span>Add your first project</span>
    </button>
  </section>
</template>

<style scoped lang="sass">
  .empty-state__title
    margin: 0
</style>
