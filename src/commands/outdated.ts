import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { C, paint } from '@/ui/colors'

type RenderMode = 'table' | 'list'

interface PackageJsonLike {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

interface RegistryInfo {
  'dist-tags'?: {
    latest?: string
  }
}

interface DependencyRow {
  name: string
  section:
    | 'dependencies'
    | 'devDependencies'
    | 'peerDependencies'
    | 'optionalDependencies'
  declared: string
  current: string | null
  latest: string | null
  status: 'outdated' | 'current' | 'unknown'
}

export async function runOutdated(args: string[]): Promise<void> {
  const mode = parseMode(args)
  const packageJson = await readPackageJson(process.cwd())

  const rows = await collectRows(process.cwd(), packageJson)
  if (rows.length === 0) {
    console.log(paint('No dependencies found in package.json', C.lavender))
    return
  }

  const outdatedRows = rows.filter(row => row.status === 'outdated')
  if (outdatedRows.length === 0) {
    console.log(paint('All dependencies are up to date', C.lavender))
    return
  }

  const grouped = groupBySection(outdatedRows)

  console.log(
    `${paint('Dependency updates available', C.bold + C.purple)} ${paint(`(${outdatedRows.length} package${outdatedRows.length === 1 ? '' : 's'})`, C.dim)}`
  )
  console.log('')

  if (mode === 'table') {
    printGroupedTable(grouped)
    return
  }

  printGroupedList(grouped)
}

function parseMode(args: string[]): RenderMode {
  let mode: RenderMode = 'table'
  for (const arg of args) {
    if (arg === '--table' || arg === '-t') {
      mode = 'table'
      continue
    }
    if (arg === '--list' || arg === '-l') {
      mode = 'list'
      continue
    }
    throw new Error(`Unknown outdated option: ${arg}`)
  }
  return mode
}

async function readPackageJson(cwd: string): Promise<PackageJsonLike> {
  const path = resolve(cwd, 'package.json')
  let value: unknown
  try {
    value = JSON.parse(await readFile(path, 'utf8'))
  } catch {
    throw new Error(`Unable to read package.json at ${path}`)
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('package.json must be a JSON object')
  }
  return value as PackageJsonLike
}

async function collectRows(
  cwd: string,
  packageJson: PackageJsonLike
): Promise<DependencyRow[]> {
  const rows = flattenDependencies(packageJson)
  await mapWithConcurrency(rows, 12, async row => {
    const current = await readInstalledVersion(cwd, row.name)
    const latest = await fetchLatestVersion(row.name)
    row.current = current
    row.latest = latest
    row.status = computeStatus(current, latest)
  })
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

function flattenDependencies(packageJson: PackageJsonLike): DependencyRow[] {
  const sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const

  const rows: DependencyRow[] = []
  for (const section of sections) {
    const deps = packageJson[section] ?? {}
    for (const [ name, declared ] of Object.entries(deps)) {
      rows.push({
        name,
        section,
        declared,
        current: null,
        latest: null,
        status: 'unknown',
      })
    }
  }
  return rows
}

async function readInstalledVersion(
  cwd: string,
  packageName: string
): Promise<string | null> {
  const packagePath = resolve(
    cwd,
    'node_modules',
    ...packageName.split('/'),
    'package.json'
  )

  try {
    const raw = await readFile(packagePath, 'utf8')
    const parsed = JSON.parse(raw) as { version?: unknown }
    return typeof parsed.version === 'string' ? parsed.version : null
  } catch {
    return null
  }
}

async function fetchLatestVersion(packageName: string): Promise<string | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return null
    const data = (await response.json()) as RegistryInfo
    return data['dist-tags']?.latest ?? null
  } catch {
    return null
  }
}

function computeStatus(
  current: string | null,
  latest: string | null
): 'outdated' | 'current' | 'unknown' {
  if (!current || !latest) return 'unknown'
  return current === latest ? 'current' : 'outdated'
}

function statusLabel(row: DependencyRow): string {
  if (row.status === 'outdated') {
    return paint('update available', C.pink)
  }
  if (row.status === 'current') {
    return paint('up to date', C.lavender)
  }
  return paint('unknown', C.dim)
}

function formatVersion(value: string | null): string {
  return value ?? '-'
}

function groupBySection(
  rows: DependencyRow[]
): Map<DependencyRow['section'], DependencyRow[]> {
  const grouped = new Map<DependencyRow['section'], DependencyRow[]>()
  for (const row of rows) {
    if (!grouped.has(row.section)) {
      grouped.set(row.section, [])
    }
    grouped.get(row.section)?.push(row)
  }
  return grouped
}

function printSectionHeading(section: DependencyRow['section']): void {
  console.log(paint(section, C.bold + C.purple))
}

function printGroupedTable(
  grouped: Map<DependencyRow['section'], DependencyRow[]>
): void {
  const order: DependencyRow['section'][] = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]

  for (const section of order) {
    const rows = grouped.get(section)
    if (!rows || rows.length === 0) continue
    printSectionHeading(section)
    printTable(rows)
    console.log('')
  }
}

function printTable(rows: DependencyRow[]): void {
  const header = {
    name: 'Package',
    declared: 'Declared',
    current: 'Current',
    latest: 'Latest',
    status: 'Status',
  }

  const nameWidth = Math.max(
    header.name.length,
    ...rows.map(row => row.name.length)
  )
  const declaredWidth = Math.max(
    header.declared.length,
    ...rows.map(row => row.declared.length)
  )
  const currentWidth = Math.max(
    header.current.length,
    ...rows.map(row => formatVersion(row.current).length)
  )
  const latestWidth = Math.max(
    header.latest.length,
    ...rows.map(row => formatVersion(row.latest).length)
  )

  const top = `${header.name.padEnd(nameWidth)}  ${header.declared.padEnd(declaredWidth)}  ${header.current.padEnd(currentWidth)}  ${header.latest.padEnd(latestWidth)}  ${header.status}`
  console.log(paint(top, C.lavender))
  console.log(paint('-'.repeat(top.length), C.dim))

  for (const row of rows) {
    const line = `${row.name.padEnd(nameWidth)}  ${row.declared.padEnd(declaredWidth)}  ${formatVersion(row.current).padEnd(currentWidth)}  ${formatVersion(row.latest).padEnd(latestWidth)}`
    console.log(`${line}  ${statusLabel(row)}`)
  }
}

function printGroupedList(
  grouped: Map<DependencyRow['section'], DependencyRow[]>
): void {
  const order: DependencyRow['section'][] = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ]

  for (const section of order) {
    const rows = grouped.get(section)
    if (!rows || rows.length === 0) continue
    printSectionHeading(section)
    for (const row of rows) {
      console.log(`${paint('•', C.pink)} ${paint(row.name, C.bold + C.purple)}`)
      console.log(
        `  ${paint('declared', C.lavender)}: ${row.declared} ${paint('|', C.dim)} ${paint('current', C.lavender)}: ${formatVersion(row.current)} ${paint('|', C.dim)} ${paint('latest', C.lavender)}: ${formatVersion(row.latest)}`
      )
      console.log(`  ${paint('status', C.lavender)}: ${statusLabel(row)}`)
      console.log('')
    }
    console.log('')
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return

  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, () =>
    (async () => {
      while (cursor < items.length) {
        const current = cursor
        cursor += 1
        const item = items[current]
        if (item === undefined) continue
        await worker(item, current)
      }
    })()
  )

  await Promise.all(runners)
}
