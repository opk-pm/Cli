<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed, onMounted, ref, watch } from 'vue'

  import IconBadge from '@/components/base/IconBadge.vue'
  import PanelHeader from '@/components/base/PanelHeader.vue'
  import { getRegistryPackages } from '@/services/api'
  import { pathLeaf } from '@/utils/path'
  import type { CommandRequest, ProjectRecord, RegistryPackage } from '@/types'

  const props = defineProps<{
    projects: ProjectRecord[]
    busy: boolean
    defaultProjectPath: string | null
  }>()

  const emit = defineEmits<{
    (event: 'run', command: CommandRequest): void
  }>()

  const loading = ref(false)
  const query = ref('')
  const packages = ref<RegistryPackage[]>([])
  const error = ref<string | null>(null)
  const targetProjectPath = ref<string | null>(props.defaultProjectPath)

  const canAdd = computed(() => !!targetProjectPath.value && !props.busy)
  const canInspect = computed(() => !!targetProjectPath.value && !props.busy)

  watch(
    () => props.projects,
    projects => {
      if (!targetProjectPath.value) {
        targetProjectPath.value = projects[0]?.path ?? null
        return
      }

      const exists = projects.some(
        project => project.path === targetProjectPath.value
      )
      if (!exists) {
        targetProjectPath.value = projects[0]?.path ?? null
      }
    },
    { immediate: true }
  )

  watch(
    () => props.defaultProjectPath,
    path => {
      if (!path) return
      if (!props.projects.some(project => project.path === path)) return
      targetProjectPath.value = path
    }
  )

  onMounted(async () => {
    await loadPackages('')
  })

  async function loadPackages(searchQuery: string): Promise<void> {
    loading.value = true
    error.value = null
    try {
      packages.value = await getRegistryPackages(searchQuery, 42)
    } catch (loadError) {
      error.value =
        loadError instanceof Error ? loadError.message : String(loadError)
    } finally {
      loading.value = false
    }
  }

  async function submitSearch(): Promise<void> {
    await loadPackages(query.value.trim())
  }

  function addPackage(pkg: RegistryPackage): void {
    if (!targetProjectPath.value) return

    const spec = `${pkg.name}@${pkg.version}`
    emit('run', {
      label: `Add ${pkg.name}`,
      args: [ 'add', spec ],
      path: targetProjectPath.value,
    })
  }

  function inspectPackage(pkg: RegistryPackage): void {
    if (!targetProjectPath.value) return

    emit('run', {
      label: `Info ${pkg.name}`,
      args: [ 'info', pkg.name ],
      path: targetProjectPath.value,
    })
  }

  function formatUpdatedAt(value: string | null): string {
    if (!value) return 'unknown'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
  }
</script>

<template>
  <section class="registry-tab">
    <section class="panel">
      <PanelHeader icon="solar:archive-bold-duotone" title="Registry Browser" />

      <div class="registry-tab__controls">
        <label class="field">
          <span class="field__label">Search npm packages</span>
          <input
            v-model="query"
            class="field__input"
            type="text"
            placeholder="react, vite, eslint..."
            :disabled="loading"
            @keydown.enter.prevent="submitSearch"
          />
        </label>
        <label class="field">
          <span class="field__label">Add to project</span>
          <select v-model="targetProjectPath" class="field__input">
            <option v-if="props.projects.length === 0" :value="null">
              No saved projects
            </option>
            <option
              v-for="project in props.projects"
              :key="project.path"
              :value="project.path"
            >
              {{ pathLeaf(project.path, project.path) }}
            </option>
          </select>
        </label>
        <button
          class="btn btn--primary"
          type="button"
          :disabled="loading"
          @click="submitSearch"
        >
          <Icon icon="solar:magnifer-bold-duotone" />
          <span>{{ loading ? 'Searching…' : 'Search' }}</span>
        </button>
      </div>
    </section>

    <section class="panel registry-tab__results">
      <PanelHeader
        icon="solar:box-bold-duotone"
        :title="query.trim() ? 'Search Results' : 'Latest npm packages'"
      >
        <IconBadge>{{ packages.length }}</IconBadge>
      </PanelHeader>

      <IconBadge v-if="error" tone="danger">{{ error }}</IconBadge>
      <div v-else-if="packages.length === 0" class="empty-card">
        <Icon
          icon="solar:archive-minimalistic-bold-duotone"
          width="38"
          height="38"
        />
        <p class="muted">No packages found.</p>
      </div>
      <div v-else class="registry-list scroll-area">
        <article
          v-for="pkg in packages"
          :key="`${pkg.name}@${pkg.version}`"
          class="registry-item"
        >
          <header class="registry-item__head">
            <div>
              <h4>{{ pkg.name }}</h4>
              <IconBadge>{{ pkg.version }}</IconBadge>
            </div>
            <div class="registry-item__actions">
              <a
                class="btn btn--ghost btn--tiny"
                :href="pkg.npmUrl"
                target="_blank"
                rel="noreferrer"
              >
                <Icon icon="solar:link-bold-duotone" />
                <span>npm</span>
              </a>
              <button
                class="btn btn--ghost btn--tiny"
                type="button"
                :disabled="!canInspect"
                @click="inspectPackage(pkg)"
              >
                <Icon icon="solar:info-circle-bold-duotone" />
                <span>Info</span>
              </button>
              <button
                class="btn btn--primary btn--tiny"
                type="button"
                :disabled="!canAdd"
                @click="addPackage(pkg)"
              >
                <Icon icon="solar:add-circle-bold-duotone" />
                <span>Add</span>
              </button>
            </div>
          </header>
          <p class="registry-item__description muted">
            {{ pkg.description || 'No description' }}
          </p>
          <footer class="registry-item__meta chip-list">
            <IconBadge icon="solar:user-rounded-bold-duotone">
              {{ pkg.publisher ?? 'unknown publisher' }}
            </IconBadge>
            <IconBadge icon="solar:clock-circle-bold-duotone">
              {{ formatUpdatedAt(pkg.updatedAt) }}
            </IconBadge>
            <IconBadge
              v-if="pkg.keywords.length > 0"
              icon="solar:tag-bold-duotone"
            >
              {{ pkg.keywords.slice(0, 4).join(', ') }}
            </IconBadge>
          </footer>
        </article>
      </div>
    </section>
  </section>
</template>

<style scoped lang="sass">
  @use '@/styles/tokens' as *

  .registry-tab
    min-height: 0
    display: grid
    gap: 8px
    grid-template-rows: auto minmax(0, 1fr)

  .registry-tab__controls
    display: grid
    grid-template-columns: minmax(0, 1fr) minmax(240px, 330px) auto
    gap: 8px
    align-items: end

  .registry-tab__results
    min-height: 0
    display: grid
    grid-template-rows: auto minmax(0, 1fr)
    gap: 8px

  .registry-list
    min-height: 0
    display: grid
    gap: 8px
    padding-right: 2px

  .registry-item
    border: 1px solid $line-card
    border-radius: 10px
    background: $surface-overlay-soft
    padding: 10px
    display: grid
    gap: 8px

  .registry-item__head
    display: flex
    justify-content: space-between
    align-items: flex-start
    gap: 8px
    h4
      margin: 0 0 4px
      font-size: 0.95rem

  .registry-item__actions
    display: inline-flex
    gap: 6px

  .registry-item__description
    margin: 0
    line-height: 1.4

  @media (max-width: 980px)
    .registry-tab__controls
      grid-template-columns: 1fr
</style>
