<script setup lang="ts">
  import {
    computed,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
  } from 'vue'

  import AddProjectModal from '@/components/AddProjectModal.vue'
  import CommandOutput from '@/components/CommandOutput.vue'
  import DependencyGraphTab from '@/components/DependencyGraphTab.vue'
  import DependencyTransferModal from '@/components/DependencyTransferModal.vue'
  import EmptyState from '@/components/EmptyState.vue'
  import NavigationTabs, {
    type NavigationTab,
  } from '@/components/NavigationTabs.vue'
  import PackagesTab from '@/components/PackagesTab.vue'
  import ProjectSidebar from '@/components/ProjectSidebar.vue'
  import ProjectTab from '@/components/ProjectTab.vue'
  import QuickActions from '@/components/QuickActions.vue'
  import RegistryTab from '@/components/RegistryTab.vue'
  import StatusBar from '@/components/StatusBar.vue'
  import { usePersistedSelection } from '@/composables/usePersistedSelection'
  import {
    getDependencyGraph,
    getProjectInfo,
    getProjectPackages,
    getProjects,
    removeProject,
    runOpkCommandStream,
  } from '@/services/api'
  import type {
    CommandRequest,
    CommandResult,
    DependencyDropScope,
    DependencyGraph,
    DependencyTransferRequest,
    DraggedDependency,
    PackageSection,
    ProjectInfo,
    ProjectRecord,
  } from '@/types'

  type TabId = 'overview' | 'packages' | 'project' | 'graph'
  type SidebarSection = 'projects' | 'registry'
  const MIN_SIDEBAR_WIDTH = 230
  const MAX_SIDEBAR_WIDTH = 560
  const MIN_OUTPUT_HEIGHT = 170
  const MAX_OUTPUT_HEIGHT = 560

  const selectedProjectPath = usePersistedSelection('opk.gui.selected-project')
  const projects = ref<ProjectRecord[]>([])
  const projectInfo = ref<ProjectInfo | null>(null)
  const packageSections = ref<PackageSection[]>([])
  const dependencyGraph = ref<DependencyGraph | null>(null)
  const commandEntries = ref<CommandResult[]>([])
  const commandControllers = new Map<string, AbortController>()
  const stopRequestedCommandIds = new Set<string>()
  const showAddModal = ref(false)
  const draggingDependency = ref<DraggedDependency | null>(null)
  const pendingDependencyTransfer = ref<DependencyTransferRequest | null>(null)
  const activeTab = ref<TabId>('overview')
  const sidebarSection = ref<SidebarSection>(readPersistedSection())
  const globalError = ref<string | null>(null)
  const sidebarWidth = ref(
    readPersistedNumber(
      'opk.gui.sidebar-width',
      290,
      MIN_SIDEBAR_WIDTH,
      MAX_SIDEBAR_WIDTH
    )
  )
  const outputHeight = ref(
    readPersistedNumber(
      'opk.gui.output-height',
      250,
      MIN_OUTPUT_HEIGHT,
      MAX_OUTPUT_HEIGHT
    )
  )
  const isResizingSidebar = ref(false)
  const isResizingOutput = ref(false)
  const loading = reactive({
    projects: false,
    projectData: false,
  })

  const tabs: NavigationTab[] = [
    { id: 'overview', label: 'Overview', icon: 'solar:widget-4-bold-duotone' },
    { id: 'packages', label: 'Packages', icon: 'solar:box-bold-duotone' },
    {
      id: 'project',
      label: 'Project',
      icon: 'solar:document-text-bold-duotone',
    },
    { id: 'graph', label: 'Graph', icon: 'solar:graph-bold-duotone' },
  ]

  const hasProjects = computed(() => projects.value.length > 0)
  const hasSelection = computed(() =>
    projects.value.some(project => project.path === selectedProjectPath.value)
  )
  const showOutputPanel = computed(
    () =>
      hasSelection.value ||
      commandEntries.value.length > 0 ||
      (sidebarSection.value === 'registry' && projects.value.length > 0)
  )
  const hasRunningCommands = computed(() =>
    commandEntries.value.some(entry => entry.running)
  )
  const shellStyle = computed(() => ({
    '--sidebar-width': `${sidebarWidth.value}px`,
    '--output-height': `${outputHeight.value}px`,
  }))

  watch(
    selectedProjectPath,
    () => {
      globalError.value = null
      void refreshProjectData()
    },
    { immediate: false }
  )

  onMounted(async () => {
    await loadProjects()
    await refreshProjectData()
  })
  onBeforeUnmount(() => {
    for (const controller of commandControllers.values()) {
      controller.abort()
    }
    commandControllers.clear()
    stopRequestedCommandIds.clear()
    stopSidebarResize()
    stopOutputResize()
  })

  watch(sidebarWidth, value => {
    persistNumber('opk.gui.sidebar-width', value)
  })
  watch(outputHeight, value => {
    persistNumber('opk.gui.output-height', value)
  })
  watch(sidebarSection, value => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('opk.gui.sidebar-section', value)
  })

  function ensureSelection(preferredPath?: string): void {
    if (
      preferredPath &&
      projects.value.some(project => project.path === preferredPath)
    ) {
      selectedProjectPath.value = preferredPath
      return
    }

    if (selectedProjectPath.value) {
      const stillExists = projects.value.some(
        project => project.path === selectedProjectPath.value
      )
      if (stillExists) return
    }

    selectedProjectPath.value = projects.value[0]?.path ?? null
  }

  async function loadProjects(preferredPath?: string): Promise<void> {
    loading.projects = true
    try {
      projects.value = await getProjects()
      ensureSelection(preferredPath)
    } catch (error) {
      globalError.value = error instanceof Error ? error.message : String(error)
    } finally {
      loading.projects = false
    }
  }

  async function refreshProjectData(): Promise<void> {
    if (!selectedProjectPath.value) {
      projectInfo.value = null
      packageSections.value = []
      dependencyGraph.value = null
      return
    }

    loading.projectData = true
    globalError.value = null
    try {
      const [ info, packages, graph ] = await Promise.all([
        getProjectInfo(selectedProjectPath.value),
        getProjectPackages(selectedProjectPath.value),
        getDependencyGraph(selectedProjectPath.value),
      ])
      projectInfo.value = info
      packageSections.value = packages
      dependencyGraph.value = graph
    } catch (error) {
      globalError.value = error instanceof Error ? error.message : String(error)
    } finally {
      loading.projectData = false
    }
  }

  function onSelectProject(path: string): void {
    selectedProjectPath.value = path
  }

  async function onRemoveProject(path: string): Promise<void> {
    globalError.value = null
    try {
      const nextProjects = await removeProject(path)
      projects.value = nextProjects
      if (selectedProjectPath.value === path) {
        selectedProjectPath.value = nextProjects[0]?.path ?? null
      }
      if (!selectedProjectPath.value) {
        projectInfo.value = null
        packageSections.value = []
        dependencyGraph.value = null
      }
    } catch (error) {
      globalError.value = error instanceof Error ? error.message : String(error)
    }
  }

  async function onProjectAdded(project: ProjectRecord): Promise<void> {
    showAddModal.value = false
    await loadProjects(project.path)
    await refreshProjectData()
  }

  async function runCommand(command: CommandRequest): Promise<void> {
    const targetPath = command.path ?? selectedProjectPath.value
    if (!targetPath) {
      globalError.value = 'Select a project first'
      return
    }
    globalError.value = null

    const entryId = crypto.randomUUID()
    commandEntries.value.push({
      id: entryId,
      label: command.label,
      args: [ ...command.args ],
      command: `opk ${command.args.join(' ')}`,
      createdAt: new Date().toISOString(),
      exitCode: null,
      stdout: '',
      stderr: '',
      output: '',
      running: true,
    })
    const entry = commandEntries.value[commandEntries.value.length - 1]!
    const controller = new AbortController()
    commandControllers.set(entryId, controller)

    try {
      await runOpkCommandStream(
        targetPath,
        command,
        {
          onMeta: event => {
            entry.args = [ ...event.args ]
            entry.command = event.command
            entry.createdAt = event.createdAt
          },
          onStdout: chunk => {
            entry.stdout += chunk
            entry.output += chunk
          },
          onStderr: chunk => {
            entry.stderr += chunk
            entry.output += chunk
          },
          onError: message => {
            globalError.value = message
            entry.stderr += entry.stderr ? `\n${message}` : message
            entry.output += entry.output ? `\n${message}` : message
          },
          onExit: exitCode => {
            entry.exitCode = exitCode
            entry.running = false
          },
        },
        {
          signal: controller.signal,
        }
      )
    } catch (error) {
      if (stopRequestedCommandIds.has(entry.id) || isAbortError(error)) {
        const stopped = '[stopped by user]'
        entry.exitCode = 130
        entry.running = false
        entry.stderr += entry.stderr ? `\n${stopped}` : stopped
        entry.output += entry.output ? `\n${stopped}` : stopped
      } else {
        const message = error instanceof Error ? error.message : String(error)
        globalError.value = message
        entry.exitCode = 1
        entry.running = false
        entry.stderr += entry.stderr ? `\n${message}` : message
        entry.output += entry.output ? `\n${message}` : message
      }
    }

    commandControllers.delete(entry.id)
    stopRequestedCommandIds.delete(entry.id)

    if (entry.running) {
      entry.running = false
    }
    if (entry.exitCode === null) {
      entry.exitCode = 1
    }

    if (entry.exitCode === 0) {
      await loadProjects(targetPath)
      if (selectedProjectPath.value === targetPath) {
        await refreshProjectData()
      }
    }
  }

  function clearCommandOutput() {
    for (const controller of commandControllers.values()) {
      controller.abort()
    }
    commandControllers.clear()
    stopRequestedCommandIds.clear()
    commandEntries.value = []
  }

  function stopCommand(entryId: string): void {
    const controller = commandControllers.get(entryId)
    if (!controller) return
    stopRequestedCommandIds.add(entryId)
    controller.abort()
  }

  function onDependencyDragStart(dependency: DraggedDependency): void {
    draggingDependency.value = dependency
  }

  function onDependencyDragEnd(): void {
    draggingDependency.value = null
  }

  function onDependencyDrop(payload: {
    targetProjectPath: string
    scope: DependencyDropScope
  }): void {
    if (!draggingDependency.value) return
    pendingDependencyTransfer.value = {
      dependency: draggingDependency.value,
      targetProjectPath: payload.targetProjectPath,
      targetScope: payload.scope,
    }
    draggingDependency.value = null
  }

  function onDependencyTransferModalToggle(value: boolean): void {
    if (value) return
    pendingDependencyTransfer.value = null
  }

  function onConfirmDependencyTransfer(strategy: 'same' | 'latest'): void {
    const transfer = pendingDependencyTransfer.value
    if (!transfer) return
    pendingDependencyTransfer.value = null

    const scopeArgs =
      transfer.targetScope === 'dev'
        ? [ '--dev' ]
        : transfer.targetScope === 'peer'
          ? [ '--peer' ]
          : []
    const spec =
      strategy === 'same'
        ? `${transfer.dependency.name}@${transfer.dependency.version}`
        : transfer.dependency.name

    void runCommand({
      label: `Transfer ${transfer.dependency.name} (${transfer.targetScope})`,
      args: [ 'add', spec, ...scopeArgs ],
      path: transfer.targetProjectPath,
    })
  }

  let detachSidebarResize: (() => void) | null = null
  let detachOutputResize: (() => void) | null = null

  function beginSidebarResize(event: MouseEvent): void {
    if (window.matchMedia('(max-width: 1180px)').matches) return
    event.preventDefault()
    stopSidebarResize()

    const startX = event.clientX
    const startWidth = sidebarWidth.value
    isResizingSidebar.value = true

    const onMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      sidebarWidth.value = clamp(
        startWidth + delta,
        MIN_SIDEBAR_WIDTH,
        MAX_SIDEBAR_WIDTH
      )
    }
    const onUp = () => {
      stopSidebarResize()
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp, { once: true })
    detachSidebarResize = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      isResizingSidebar.value = false
    }
  }

  function beginOutputResize(event: MouseEvent): void {
    event.preventDefault()
    stopOutputResize()

    const startY = event.clientY
    const startHeight = outputHeight.value
    isResizingOutput.value = true

    const onMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY
      const dynamicMax = Math.max(
        MIN_OUTPUT_HEIGHT + 40,
        window.innerHeight - 230
      )
      outputHeight.value = clamp(
        startHeight + delta,
        MIN_OUTPUT_HEIGHT,
        Math.min(MAX_OUTPUT_HEIGHT, dynamicMax)
      )
    }
    const onUp = () => {
      stopOutputResize()
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp, { once: true })
    detachOutputResize = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      isResizingOutput.value = false
    }
  }

  function stopSidebarResize(): void {
    if (!detachSidebarResize) return
    detachSidebarResize()
    detachSidebarResize = null
  }

  function stopOutputResize(): void {
    if (!detachOutputResize) return
    detachOutputResize()
    detachOutputResize = null
  }

  function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max)
  }

  function readPersistedNumber(
    key: string,
    fallback: number,
    min: number,
    max: number
  ): number {
    if (typeof window === 'undefined') return fallback
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = Number.parseInt(raw, 10)
    if (!Number.isFinite(parsed)) return fallback
    return clamp(parsed, min, max)
  }

  function persistNumber(key: string, value: number): void {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, `${value}`)
  }

  function readPersistedSection(): SidebarSection {
    if (typeof window === 'undefined') return 'projects'
    const value = window.localStorage.getItem('opk.gui.sidebar-section')
    return value === 'registry' ? 'registry' : 'projects'
  }

  function isAbortError(error: unknown): boolean {
    return error instanceof Error && error.name === 'AbortError'
  }
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--resizing-sidebar': isResizingSidebar,
      'app-shell--resizing-output': isResizingOutput,
    }"
    :style="shellStyle"
  >
    <div class="sidebar-column">
      <ProjectSidebar
        :projects="projects"
        :selected-path="selectedProjectPath"
        :active-section="sidebarSection"
        :loading="loading.projects"
        :dragging-dependency="draggingDependency"
        @select="onSelectProject"
        @add="showAddModal = true"
        @remove="onRemoveProject"
        @change-section="sidebarSection = $event"
        @drop-dependency="onDependencyDrop"
      />
    </div>
    <button
      class="panel-resizer panel-resizer--sidebar"
      type="button"
      aria-label="Resize sidebar"
      @mousedown="beginSidebarResize"
    />

    <main class="workspace-column">
      <StatusBar
        :project-path="selectedProjectPath"
        :info="projectInfo"
        :loading="loading.projectData || hasRunningCommands"
      />

      <section
        class="workspace-content"
        :class="{ 'workspace-content--with-output': showOutputPanel }"
      >
        <div class="workspace-top">
          <div v-if="globalError" class="badge badge--danger">
            {{ globalError }}
          </div>
          <NavigationTabs
            v-if="sidebarSection === 'projects' && hasSelection"
            v-model="activeTab"
            :tabs="tabs"
          />
        </div>

        <section class="workspace-main-area">
          <template v-if="sidebarSection === 'registry'">
            <RegistryTab
              :projects="projects"
              :busy="false"
              :default-project-path="selectedProjectPath"
              @run="runCommand"
            />
          </template>
          <template v-else-if="!hasProjects || !hasSelection">
            <EmptyState
              :has-projects="hasProjects"
              @add="showAddModal = true"
            />
          </template>

          <template v-else>
            <section class="tab-content">
              <template v-if="activeTab === 'overview'">
                <div class="split-grid">
                  <QuickActions
                    :project-path="selectedProjectPath"
                    :busy="false"
                    @run="runCommand"
                  />
                  <ProjectTab
                    :info="projectInfo"
                    :busy="false"
                    @run="runCommand"
                  />
                </div>
              </template>
              <PackagesTab
                v-else-if="activeTab === 'packages'"
                :packages="packageSections"
                :busy="false"
                :source-project-path="selectedProjectPath"
                @run="runCommand"
                @dependency-drag-start="onDependencyDragStart"
                @dependency-drag-end="onDependencyDragEnd"
              />
              <ProjectTab
                v-else-if="activeTab === 'project'"
                :info="projectInfo"
                :busy="false"
                @run="runCommand"
              />
              <DependencyGraphTab v-else :graph="dependencyGraph" />
            </section>
          </template>
        </section>

        <button
          v-if="showOutputPanel"
          class="panel-resizer panel-resizer--output"
          type="button"
          aria-label="Resize command output panel"
          @mousedown="beginOutputResize"
        />
        <div v-if="showOutputPanel" class="workspace-output">
          <CommandOutput
            :entries="commandEntries"
            @clear="clearCommandOutput"
            @stop="stopCommand"
          />
        </div>
      </section>
    </main>

    <AddProjectModal v-model="showAddModal" @added="onProjectAdded" />
    <DependencyTransferModal
      :model-value="pendingDependencyTransfer !== null"
      :transfer="pendingDependencyTransfer"
      @update:model-value="onDependencyTransferModalToggle"
      @confirm="onConfirmDependencyTransfer"
    />
  </div>
</template>
