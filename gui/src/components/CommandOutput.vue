<script setup lang="ts">
  import { Icon } from '@iconify/vue'
  import { computed } from 'vue'

  import IconBadge from '@/components/base/IconBadge.vue'
  import PanelHeader from '@/components/base/PanelHeader.vue'
  import { readThemeColor, readThemeColorList } from '@/styles/runtimeTheme'
  import type { CommandResult } from '@/types'

  const props = defineProps<{
    entries: CommandResult[]
  }>()

  const emit = defineEmits<{
    (event: 'clear'): void
  }>()

  const latestFirst = computed(() => [ ...props.entries ].reverse())
  const BASIC_COLOR_VARS = [
    '--ansi-basic-0',
    '--ansi-basic-1',
    '--ansi-basic-2',
    '--ansi-basic-3',
    '--ansi-basic-4',
    '--ansi-basic-5',
    '--ansi-basic-6',
    '--ansi-basic-7',
  ] as const
  const BRIGHT_COLOR_VARS = [
    '--ansi-bright-0',
    '--ansi-bright-1',
    '--ansi-bright-2',
    '--ansi-bright-3',
    '--ansi-bright-4',
    '--ansi-bright-5',
    '--ansi-bright-6',
    '--ansi-bright-7',
  ] as const
  const BASIC_COLORS = readThemeColorList(
    BASIC_COLOR_VARS,
    new Array(BASIC_COLOR_VARS.length).fill('currentColor')
  )
  const BRIGHT_COLORS = readThemeColorList(
    BRIGHT_COLOR_VARS,
    new Array(BRIGHT_COLOR_VARS.length).fill('currentColor')
  )
  const DEFAULT_TEXT_COLOR = readThemeColor('--theme-text-command', 'currentColor')

  interface AnsiState {
    bold: boolean
    dim: boolean
    italic: boolean
    underline: boolean
    foreground: string | null
    background: string | null
  }

  function formatTimestamp(value: string): string {
    try {
      return new Date(value).toLocaleString()
    } catch {
      return value
    }
  }

  function renderOutput(entry: CommandResult): string {
    const raw = entry.stdout || entry.stderr || '(no output)'
    return ansiToHtml(raw)
  }

  function ansiToHtml(input: string): string {
    const pattern = /\u001b\[([0-9;]*)m/g
    const state: AnsiState = {
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      foreground: null,
      background: null,
    }

    let result = ''
    let cursor = 0
    let match: RegExpExecArray | null = null

    while ((match = pattern.exec(input)) !== null) {
      const chunk = input.slice(cursor, match.index)
      if (chunk) {
        result += wrapWithState(chunk, state)
      }
      applyCodes(state, parseCodes(match[1] ?? ''))
      cursor = pattern.lastIndex
    }

    const tail = input.slice(cursor)
    if (tail) {
      result += wrapWithState(tail, state)
    }

    return result || '&nbsp;'
  }

  function parseCodes(raw: string): number[] {
    if (!raw) return [ 0 ]
    return raw
      .split(';')
      .map(part => Number.parseInt(part, 10))
      .filter(code => Number.isInteger(code))
  }

  function applyCodes(state: AnsiState, codes: number[]): void {
    if (codes.length === 0) {
      resetAnsiState(state)
      return
    }

    for (let index = 0; index < codes.length; index += 1) {
      const code = codes[index]!

      if (code === 0) {
        resetAnsiState(state)
        continue
      }
      if (code === 1) {
        state.bold = true
        continue
      }
      if (code === 2) {
        state.dim = true
        continue
      }
      if (code === 3) {
        state.italic = true
        continue
      }
      if (code === 4) {
        state.underline = true
        continue
      }
      if (code === 22) {
        state.bold = false
        state.dim = false
        continue
      }
      if (code === 23) {
        state.italic = false
        continue
      }
      if (code === 24) {
        state.underline = false
        continue
      }
      if (code === 39) {
        state.foreground = null
        continue
      }
      if (code === 49) {
        state.background = null
        continue
      }
      if (code >= 30 && code <= 37) {
        state.foreground = BASIC_COLORS[code - 30] ?? null
        continue
      }
      if (code >= 40 && code <= 47) {
        state.background = BASIC_COLORS[code - 40] ?? null
        continue
      }
      if (code >= 90 && code <= 97) {
        state.foreground = BRIGHT_COLORS[code - 90] ?? null
        continue
      }
      if (code >= 100 && code <= 107) {
        state.background = BRIGHT_COLORS[code - 100] ?? null
        continue
      }

      if ((code === 38 || code === 48) && codes[index + 1] === 5) {
        const paletteIndex = codes[index + 2]
        if (typeof paletteIndex === 'number') {
          const color = xterm256ToHex(paletteIndex)
          if (code === 38) state.foreground = color
          if (code === 48) state.background = color
        }
        index += 2
        continue
      }

      if ((code === 38 || code === 48) && codes[index + 1] === 2) {
        const [ r, g, b ] = [ codes[index + 2], codes[index + 3], codes[index + 4] ]
        if ([ r, g, b ].every(channel => typeof channel === 'number')) {
          const color = `rgb(${r}, ${g}, ${b})`
          if (code === 38) state.foreground = color
          if (code === 48) state.background = color
        }
        index += 4
      }
    }
  }

  function wrapWithState(chunk: string, state: AnsiState): string {
    const escaped = escapeHtml(chunk)
    const style = buildInlineStyle(state)
    if (!style) {
      return escaped
    }
    return `<span style="${style}">${escaped}</span>`
  }

  function buildInlineStyle(state: AnsiState): string {
    const rules: string[] = []
    if (state.foreground) rules.push(`color:${state.foreground}`)
    if (state.background) rules.push(`background-color:${state.background}`)
    if (state.bold) rules.push('font-weight:700')
    if (state.italic) rules.push('font-style:italic')
    if (state.underline) rules.push('text-decoration:underline')
    if (state.dim) rules.push('opacity:0.78')
    return rules.join(';')
  }

  function resetAnsiState(state: AnsiState): void {
    state.bold = false
    state.dim = false
    state.italic = false
    state.underline = false
    state.foreground = null
    state.background = null
  }

  function xterm256ToHex(index: number): string {
    if (index < 0) return DEFAULT_TEXT_COLOR
    if (index < 8) return BASIC_COLORS[index] ?? DEFAULT_TEXT_COLOR
    if (index < 16) return BRIGHT_COLORS[index - 8] ?? DEFAULT_TEXT_COLOR
    if (index < 232) {
      const value = index - 16
      const r = Math.floor(value / 36)
      const g = Math.floor((value % 36) / 6)
      const b = value % 6
      const levels = [ 0, 95, 135, 175, 215, 255 ]
      return rgbToHex(levels[r]!, levels[g]!, levels[b]!)
    }
    if (index <= 255) {
      const gray = 8 + (index - 232) * 10
      return rgbToHex(gray, gray, gray)
    }
    return DEFAULT_TEXT_COLOR
  }

  function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (value: number) => value.toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
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
  <section class="panel command-output">
    <PanelHeader icon="solar:terminal-bold-duotone" title="Command Output">
      <button
        class="btn btn--ghost btn--tiny"
        type="button"
        :disabled="props.entries.length === 0"
        @click="emit('clear')"
      >
        <Icon icon="solar:trash-bin-trash-bold-duotone" />
        <span>Clear</span>
      </button>
    </PanelHeader>

    <div v-if="props.entries.length === 0" class="command-output__empty muted">
      No commands have been run yet.
    </div>

    <div v-else class="command-output__list scroll-area">
      <article
        v-for="entry in latestFirst"
        :key="entry.id"
        class="command-entry"
        :class="{
          'command-entry--error': entry.exitCode !== 0,
          'command-entry--ok': entry.exitCode === 0,
        }"
      >
        <header class="command-entry__head">
          <div class="command-entry__title">
            <strong>{{ entry.label }}</strong>
            <IconBadge>{{ formatTimestamp(entry.createdAt) }}</IconBadge>
          </div>
          <IconBadge
            :tone="entry.exitCode === 0 ? 'success' : 'danger'"
          >
            exit {{ entry.exitCode }}
          </IconBadge>
        </header>
        <p class="command-entry__cmd">{{ entry.command }}</p>
        <pre
          class="command-entry__body"
        ><code v-html="renderOutput(entry)" /></pre>
      </article>
    </div>
  </section>
</template>

<style scoped lang="sass">
  @use '@/styles/tokens' as *

  .command-output
    height: 100%
    min-height: 0
    display: grid
    grid-template-rows: auto minmax(0, 1fr)

  .command-output__empty
    border: 1px dashed $line-soft
    border-radius: 10px
    min-height: 90px
    display: grid
    place-items: center

  .command-output__list
    min-height: 0
    display: grid
    gap: 10px
    padding-right: 2px

  .command-entry
    border: 1px solid $line-soft
    border-radius: 12px
    padding: 10px
    background: $surface-overlay-soft

  .command-entry--ok
    border-color: $line-success-strong

  .command-entry--error
    border-color: $line-danger

  .command-entry__head
    display: flex
    justify-content: space-between
    align-items: center
    gap: 10px

  .command-entry__title
    display: inline-flex
    align-items: center
    gap: 8px
    min-width: 0
    strong
      white-space: nowrap
      overflow: hidden
      text-overflow: ellipsis

  .command-entry__cmd
    margin: 8px 0
    padding: 6px 8px
    border-radius: 8px
    font-family: $mono-font
    font-size: 0.8rem
    color: $text-secondary
    background: $surface-command
    border: 1px solid $line-muted

  .command-entry__body
    max-height: 180px
    overflow: auto
    padding: 10px
    border-radius: 8px
    background: $surface-terminal
    border: 1px solid $line-subtle
    color: $text-command

  .command-entry__body code
    font-family: $mono-font
    font-size: 0.83rem
</style>
