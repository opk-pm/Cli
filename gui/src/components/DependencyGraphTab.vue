<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import * as echarts from 'echarts'
  import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import type { DependencyGraph, GraphNode } from '@/types'

  interface GroupedNode {
    id: string
    label: string
    members: number
    scope: string | null
    kind: 'root' | 'scope' | 'package'
    sizeBytes: number
    color: string
  }

  interface GroupedEdge {
    from: string
    to: string
  }

  const NODE_PALETTE = [
    '#78a6ff',
    '#66d3ae',
    '#ffc674',
    '#ff96be',
    '#9acbff',
    '#c4a2ff',
    '#74e4d0',
    '#d9b5ff',
  ]

  const props = defineProps<{
    graph: DependencyGraph | null
  }>()

  const chartElement = ref<HTMLDivElement | null>(null)
  let chartInstance: echarts.ECharts | null = null
  let resizeObserver: ResizeObserver | null = null

  const groupedGraph = computed(() => groupGraph(props.graph))
  const totalInstallSize = computed(() =>
    groupedGraph.value.nodes
      .filter(node => node.kind !== 'root')
      .reduce((sum, node) => sum + Math.max(node.sizeBytes, 0), 0)
  )
  const topHeavyNodes = computed(() =>
    groupedGraph.value.nodes
      .filter(node => node.kind !== 'root')
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 8)
  )

  watch(chartElement, element => {
    if (!element) {
      teardownChart()
      return
    }

    if (chartInstance && chartInstance.getDom() === element) return
    teardownChart()
    chartInstance = echarts.init(element)
    resizeObserver = new ResizeObserver(() => chartInstance?.resize())
    resizeObserver.observe(element)
    renderChart()
  })

  watch(groupedGraph, () => {
    renderChart()
  })

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize)
    teardownChart()
  })

  function handleResize(): void {
    chartInstance?.resize()
  }

  function teardownChart(): void {
    resizeObserver?.disconnect()
    resizeObserver = null
    chartInstance?.dispose()
    chartInstance = null
  }

  function renderChart(): void {
    if (!chartInstance) return
    const graph = groupedGraph.value

    if (!props.graph || graph.nodes.length === 0) {
      chartInstance.clear()
      return
    }

    const nonRootSizes = graph.nodes
      .filter(node => node.kind !== 'root')
      .map(node => Math.max(node.sizeBytes, 1))
    const minSize = nonRootSizes.length > 0 ? Math.min(...nonRootSizes) : 1
    const maxSize = nonRootSizes.length > 0 ? Math.max(...nonRootSizes) : 1

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      animationDuration: 420,
      tooltip: {
        trigger: 'item',
        backgroundColor: 'rgba(10, 14, 24, 0.96)',
        borderColor: 'rgba(135, 172, 255, 0.28)',
        textStyle: { color: '#dce7ff' },
        formatter: params => {
          const data = params.data as
            | (GroupedNode & { name: string })
            | (GroupedEdge & { source: string; target: string })
          if ('members' in data) {
            const groupLabel =
              data.kind === 'scope' ? 'Scoped group' : 'Package'
            return [
              `<strong>${escapeHtml(data.label)}</strong>`,
              `${groupLabel}: ${data.members} node(s)`,
              `Estimated size: ${formatBytes(data.sizeBytes)}`,
            ].join('<br/>')
          }
          return `${escapeHtml(data.source)} → ${escapeHtml(data.target)}`
        },
      },
      series: [
        {
          type: 'graph',
          layout: 'force',
          roam: true,
          draggable: true,
          focusNodeAdjacency: true,
          force: {
            repulsion: graph.nodes.length > 90 ? 120 : 180,
            edgeLength: [38, 116],
            gravity: 0.08,
          },
          label: {
            show: true,
            color: '#dce7ff',
            fontSize: 11,
            formatter: params => {
              const data = params.data as GroupedNode & { name: string }
              if (graph.nodes.length > 120 && data.kind === 'package') {
                return ''
              }
              return data.name
            },
          },
          lineStyle: {
            color: 'source',
            width: 1.15,
            opacity: 0.38,
            curveness: 0.08,
          },
          data: graph.nodes.map(node => ({
            id: node.id,
            name: node.label,
            value: node.sizeBytes,
            members: node.members,
            kind: node.kind,
            symbolSize: computeNodeSize(node, minSize, maxSize),
            itemStyle: {
              color: node.color,
              borderColor: 'rgba(255,255,255,0.18)',
              borderWidth: node.kind === 'root' ? 1.6 : 1,
            },
          })),
          links: graph.edges.map(edge => ({
            source: edge.from,
            target: edge.to,
          })),
        },
      ],
    }

    chartInstance.setOption(option, true)
  }

  function groupGraph(graph: DependencyGraph | null): {
    nodes: GroupedNode[]
    edges: GroupedEdge[]
  } {
    if (!graph) return { nodes: [], edges: [] }

    const groups = new Map<string, GroupedNode>()
    const keyByNodeId = new Map<string, string>()
    for (const node of graph.nodes) {
      const key = graphGroupKey(node)
      keyByNodeId.set(node.id, key)

      const sizeBytes = Math.max(node.sizeBytes ?? 0, 0)
      const scope = node.scope ?? extractScope(node.packageName)
      const kind: GroupedNode['kind'] =
        node.id === 'root' ? 'root' : scope ? 'scope' : 'package'
      const label =
        kind === 'root'
          ? node.label
          : kind === 'scope'
            ? `${scope ?? 'scope'}/*`
            : (node.packageName ?? node.label)

      const existing = groups.get(key)
      if (existing) {
        existing.members += 1
        existing.sizeBytes += sizeBytes
        continue
      }

      groups.set(key, {
        id: key,
        label,
        members: 1,
        scope,
        kind,
        sizeBytes,
        color: colorForNode(key, kind),
      })
    }

    const edges: GroupedEdge[] = []
    const edgeSet = new Set<string>()
    for (const edge of graph.edges) {
      const from = keyByNodeId.get(edge.from)
      const to = keyByNodeId.get(edge.to)
      if (!from || !to || from === to) continue
      const key = `${from}=>${to}`
      if (edgeSet.has(key)) continue
      edgeSet.add(key)
      edges.push({ from, to })
    }

    return {
      nodes: Array.from(groups.values()),
      edges,
    }
  }

  function graphGroupKey(node: GraphNode): string {
    if (node.id === 'root') return 'root'
    const scope = node.scope ?? extractScope(node.packageName)
    if (scope) return `scope:${scope}`
    return `node:${node.id}`
  }

  function extractScope(packageName: string | null | undefined): string | null {
    if (!packageName || !packageName.startsWith('@')) return null
    const splitAt = packageName.indexOf('/')
    return splitAt > 1 ? packageName.slice(0, splitAt) : null
  }

  function computeNodeSize(
    node: GroupedNode,
    minSize: number,
    maxSize: number
  ): number {
    if (node.kind === 'root') return 52
    const safeValue = Math.max(node.sizeBytes, 1)
    if (maxSize <= minSize) {
      return node.kind === 'scope' ? 36 : 24
    }

    const minLog = Math.log10(minSize + 1)
    const maxLog = Math.log10(maxSize + 1)
    const ratio = (Math.log10(safeValue + 1) - minLog) / (maxLog - minLog)
    const base = node.kind === 'scope' ? 24 : 16
    const range = node.kind === 'scope' ? 42 : 30
    return base + ratio * range
  }

  function colorForNode(key: string, kind: GroupedNode['kind']): string {
    if (kind === 'root') return '#8bb4ff'
    const index = Math.abs(hashCode(key)) % NODE_PALETTE.length
    return NODE_PALETTE[index]
  }

  function hashCode(value: string): number {
    let hash = 0
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash << 5) - hash + value.charCodeAt(index)
      hash |= 0
    }
    return hash
  }

  function formatBytes(bytes: number): string {
    if (bytes <= 0) return 'unknown'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex += 1
    }
    return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
  }

  function escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')
  }
</script>

<template>
  <section v-if="props.graph" class="graph-tab">
    <div class="panel graph-head">
      <h3 class="panel-title">
        <Icon icon="solar:graph-bold-duotone" />
        <span>Dependency Graph</span>
      </h3>
      <div class="graph-head__meta">
        <span class="badge">
          <Icon icon="solar:database-bold-duotone" />
          Source: {{ props.graph.source }}
        </span>
        <span class="badge">
          <Icon icon="solar:nodes-bold-duotone" />
          {{ groupedGraph.nodes.length }} grouped nodes
        </span>
        <span class="badge">
          <Icon icon="solar:link-bold-duotone" />
          {{ groupedGraph.edges.length }} grouped edges
        </span>
        <span class="badge">
          <Icon icon="solar:chart-square-bold-duotone" />
          Install size: {{ formatBytes(totalInstallSize) }}
        </span>
      </div>
    </div>

    <div v-if="groupedGraph.nodes.length <= 1" class="empty-card">
      <Icon icon="solar:graph-new-up-bold-duotone" width="42" height="42" />
      <p>
        No dependency links found. Generate a lockfile to enrich this graph.
      </p>
    </div>

    <template v-else>
      <section class="panel graph-canvas-panel">
        <div ref="chartElement" class="graph-canvas" />
      </section>

      <section class="panel graph-size-panel">
        <h3 class="panel-title">
          <Icon icon="solar:sort-by-time-bold-duotone" />
          <span>Largest groups</span>
        </h3>
        <div class="size-list">
          <div v-for="node in topHeavyNodes" :key="node.id" class="size-item">
            <span class="size-item__name">
              <span
                class="size-item__swatch"
                :style="{ background: node.color }"
              />
              <span>{{ node.label }}</span>
            </span>
            <span class="badge">
              {{ formatBytes(node.sizeBytes) }} · {{ node.members }} node(s)
            </span>
          </div>
        </div>
      </section>
    </template>
  </section>
  <section v-else class="empty-card">
    <Icon icon="solar:graph-new-up-bold-duotone" width="42" height="42" />
    <p>Dependency graph unavailable.</p>
  </section>
</template>

<style scoped lang="sass">
  @use '../../styles/tokens' as *

  .graph-tab
    min-height: 0
    display: grid
    grid-template-rows: auto minmax(320px, 1fr) auto
    gap: 8px

  .graph-head
    display: grid
    gap: 8px

  .graph-head__meta
    display: flex
    gap: 8px
    flex-wrap: wrap

  .graph-canvas-panel
    min-height: 0
    overflow: hidden
    padding: 0

  .graph-canvas
    width: 100%
    height: 100%
    min-height: 340px

  .graph-size-panel
    display: grid
    gap: 8px

  .size-list
    max-height: 180px
    overflow: auto
    display: grid
    gap: 6px

  .size-item
    min-width: 0
    display: flex
    align-items: center
    justify-content: space-between
    gap: 8px
    padding: 6px 8px
    border-radius: 8px
    background: rgba(255, 255, 255, 0.03)

  .size-item__name
    min-width: 0
    display: inline-flex
    align-items: center
    gap: 8px
    span:last-child
      min-width: 0
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis

  .size-item__swatch
    width: 10px
    height: 10px
    border-radius: 99px
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.22)
</style>
