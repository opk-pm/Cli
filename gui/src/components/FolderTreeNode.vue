<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import type { TreeNode } from '@/types'

  defineOptions({
    name: 'FolderTreeNode',
  })

  const props = defineProps<{
    node: TreeNode
    selectedPath: string | null
  }>()

  const emit = defineEmits<{
    (event: 'toggle', node: TreeNode): void
    (event: 'select', node: TreeNode): void
  }>()
</script>

<template>
  <li class="tree-node">
    <div
      class="tree-node__row"
      :class="{
        'tree-node__row--active': props.node.path === props.selectedPath,
      }"
      @click="emit('select', props.node)"
    >
      <button
        class="tree-node__toggle"
        type="button"
        :disabled="!props.node.isDirectory"
        @click.stop="emit('toggle', props.node)"
      >
        <Icon
          :icon="
            props.node.expanded
              ? 'solar:alt-arrow-down-bold-duotone'
              : 'solar:alt-arrow-right-bold-duotone'
          "
        />
      </button>
      <Icon icon="solar:folder-bold-duotone" />
      <span class="tree-node__name">{{ props.node.name }}</span>
      <Icon
        v-if="props.node.loading"
        icon="solar:refresh-bold-duotone"
        class="tree-node__loading"
      />
    </div>

    <ul
      v-if="props.node.expanded && props.node.children.length > 0"
      class="tree-node__children"
    >
      <FolderTreeNode
        v-for="child in props.node.children"
        :key="child.path"
        :node="child"
        :selected-path="props.selectedPath"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
      />
    </ul>
  </li>
</template>

<style scoped lang="sass">
  @use '../../styles/tokens' as *

  .tree-node
    list-style: none

  .tree-node__row
    min-height: 30px
    padding: 0 6px
    border-radius: 8px
    display: flex
    align-items: center
    gap: 6px
    color: $text-secondary
    cursor: pointer
    &:hover
      background: rgba(255, 255, 255, 0.04)

  .tree-node__row--active
    background: rgb(148 112 255 / 0.18)
    color: $text-primary

  .tree-node__toggle
    border: 0
    background: transparent
    color: inherit
    width: 18px
    height: 18px
    display: grid
    place-items: center
    border-radius: 6px
    cursor: pointer
    &:disabled
      opacity: 0.15
      cursor: default

  .tree-node__name
    white-space: nowrap
    overflow: hidden
    text-overflow: ellipsis

  .tree-node__loading
    margin-left: auto
    animation: spin 0.9s linear infinite

  .tree-node__children
    margin: 0
    padding: 0 0 0 15px

  @keyframes spin
    to
      transform: rotate(360deg)
</style>
