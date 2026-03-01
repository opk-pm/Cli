<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed, ref } from 'vue'
  import type { CommandRequest, PackageSection } from '@/types'

  const props = defineProps<{
    packages: PackageSection[]
    busy: boolean
  }>()

  const emit = defineEmits<{
    (event: 'run', command: CommandRequest): void
  }>()

  const search = ref('')
  const packageInput = ref('')
  const mode = ref<'add' | 'remove'>('add')
  const scope = ref<'none' | 'dev' | 'peer' | 'optional'>('none')

  const filteredSections = computed(() => {
    const keyword = search.value.trim().toLowerCase()
    if (!keyword) return props.packages
    return props.packages
      .map(section => ({
        ...section,
        entries: section.entries.filter(entry =>
          `${entry.name} ${entry.version}`.toLowerCase().includes(keyword)
        ),
      }))
      .filter(section => section.entries.length > 0)
  })

  function runPackageAction(): void {
    const packageName = packageInput.value.trim()
    if (!packageName) return

    const args = [mode.value, packageName]
    if (mode.value === 'add') {
      if (scope.value === 'dev') args.push('--dev')
      if (scope.value === 'peer') args.push('--peer')
      if (scope.value === 'optional') args.push('--optional')
    }

    emit('run', {
      label: `${mode.value} ${packageName}`,
      args,
    })
    packageInput.value = ''
  }
</script>

<template>
  <section class="packages-tab">
    <div class="panel">
      <div class="title-row">
        <h3 class="title-row__heading">
          <Icon icon="solar:box-bold-duotone" />
          <span>Package Actions</span>
        </h3>
      </div>
      <div class="packages-tab__controls">
        <label class="field">
          <span class="field__label">Action</span>
          <select v-model="mode" class="field__input" :disabled="props.busy">
            <option value="add">add</option>
            <option value="remove">remove</option>
          </select>
        </label>

        <label class="field">
          <span class="field__label">Package</span>
          <input
            v-model="packageInput"
            class="field__input"
            type="text"
            placeholder="lodash"
            :disabled="props.busy"
            @keydown.enter.prevent="runPackageAction"
          />
        </label>

        <label class="field">
          <span class="field__label">Scope (add only)</span>
          <select
            v-model="scope"
            class="field__input"
            :disabled="props.busy || mode === 'remove'"
          >
            <option value="none">default</option>
            <option value="dev">dev</option>
            <option value="peer">peer</option>
            <option value="optional">optional</option>
          </select>
        </label>

        <button
          class="btn btn--primary"
          type="button"
          :disabled="props.busy || !packageInput.trim()"
          @click="runPackageAction"
        >
          <Icon icon="solar:play-circle-bold-duotone" />
          <span>Run</span>
        </button>
      </div>
    </div>

    <div class="panel packages-tab__list">
      <div class="title-row">
        <h3 class="title-row__heading">
          <Icon icon="solar:archive-minimalistic-bold-duotone" />
          <span>Installed Packages</span>
        </h3>
        <label class="field">
          <span class="field__label">Search</span>
          <input
            v-model="search"
            class="field__input"
            type="text"
            placeholder="Filter by name or version"
          />
        </label>
      </div>

      <div v-if="filteredSections.length === 0" class="empty-list muted">
        No packages match your search.
      </div>
      <div v-else class="section-list">
        <section
          v-for="section in filteredSections"
          :key="section.section"
          class="deps-section"
        >
          <h4>
            {{ section.section }}
            <span class="badge">{{ section.entries.length }}</span>
          </h4>
          <ul>
            <li
              v-for="entry in section.entries"
              :key="`${section.section}:${entry.name}`"
            >
              <span class="deps-name">{{ entry.name }}</span>
              <span class="deps-version">{{ entry.version }}</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped lang="sass">
  @use '../../styles/tokens' as *

  .packages-tab
    display: grid
    gap: 12px

  .packages-tab__controls
    display: grid
    grid-template-columns: 140px minmax(0, 1fr) 170px auto
    gap: 10px
    align-items: end

  .packages-tab__list
    min-height: 380px

  .section-list
    display: grid
    gap: 10px

  .deps-section
    border: 1px solid $line-soft
    border-radius: 12px
    padding: 10px 12px
    background: rgba(255, 255, 255, 0.02)
    h4
      margin: 0 0 8px
      display: flex
      align-items: center
      justify-content: space-between
    ul
      margin: 0
      padding: 0
      list-style: none
      display: grid
      gap: 6px
    li
      display: flex
      justify-content: space-between
      align-items: center
      gap: 12px
      padding: 6px 8px
      border-radius: 8px
      background: rgba(255, 255, 255, 0.02)

  .deps-name
    color: $text-primary
    font-weight: 500

  .deps-version
    color: $text-muted
    font-family: $mono-font
    font-size: 0.84rem

  .empty-list
    border: 1px dashed $line-soft
    border-radius: 10px
    min-height: 90px
    display: grid
    place-items: center

  @media (max-width: 980px)
    .packages-tab__controls
      grid-template-columns: 1fr
</style>
