import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { C, paint } from '@/ui/colors'

interface NpmMaintainer {
  name: string
  email?: string
}

interface NpmVersionData {
  description?: string
  license?: string
  type?: string
  main?: string
  module?: string
  exports?: unknown
  types?: string
  typings?: string
  typesVersions?: Record<string, unknown>
  dependencies?: Record<string, string>
  dist?: {
    tarball?: string
    shasum?: string
    integrity?: string
    unpackedSize?: number
  }
  maintainers?: NpmMaintainer[]
}

interface NpmInfo {
  name: string
  description?: string
  license?: string
  keywords?: string[]
  homepage?: string
  repository?: string | { url?: string }
  maintainers?: NpmMaintainer[]
  versions?: Record<string, NpmVersionData>
  'dist-tags'?: Record<string, string>
  time?: Record<string, string>
}

interface PackageManifestLike {
  name?: string
  type?: string
  main?: string
  module?: string
  exports?: unknown
  types?: string
  typings?: string
  typesVersions?: Record<string, unknown>
}

interface TypesSupportInfo {
  status: 'bundled' | 'types-package' | 'none'
  typesPackageName?: string
  latestTypesVersion?: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter(item => typeof item === 'string') as string[]
}

function normalizeDeps(value: unknown): Record<string, string> {
  const record = asRecord(value)
  if (!record) return {}

  return Object.fromEntries(
    Object.entries(record).filter(
      ([ , depVersion ]) => typeof depVersion === 'string'
    )
  ) as Record<string, string>
}

function hasTypesInExports(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) {
    return value.some(item => hasTypesInExports(item))
  }

  for (const [ key, child ] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'types') return true
    if (hasTypesInExports(child)) return true
  }

  return false
}

function hasBundledTypes(manifest: PackageManifestLike): boolean {
  return Boolean(
    manifest.types ||
    manifest.typings ||
    manifest.typesVersions ||
    hasTypesInExports(manifest.exports)
  )
}

function detectModuleSystem(manifest: PackageManifestLike): string {
  if (manifest.type === 'module') return 'ESM'
  if (manifest.type === 'commonjs') return 'CJS'

  const main = manifest.main ?? ''
  if (main.endsWith('.mjs')) return 'ESM'
  if (main.endsWith('.cjs')) return 'CJS'

  if (typeof manifest.exports === 'string') {
    if (manifest.exports.endsWith('.mjs')) return 'ESM'
    if (manifest.exports.endsWith('.cjs')) return 'CJS'
  }

  const exportsObject =
    manifest.exports && typeof manifest.exports === 'object'
      ? (manifest.exports as Record<string, unknown>)
      : null
  if (exportsObject) {
    const exportsText = JSON.stringify(exportsObject)
    const hasImport = exportsText.includes('"import"')
    const hasRequire = exportsText.includes('"require"')
    if (hasImport && hasRequire) return 'ESM+CJS'
    if (hasImport) return 'ESM'
    if (hasRequire) return 'CJS'
  }

  if (manifest.module) return 'ESM'
  return 'Unknown'
}

function toTypesPackageName(packageName: string): string {
  if (packageName.startsWith('@')) {
    const value = packageName.slice(1)
    const slash = value.indexOf('/')
    if (slash > 0) {
      const scope = value.slice(0, slash)
      const name = value.slice(slash + 1)
      return `@types/${scope}__${name}`
    }
  }
  return `@types/${packageName}`
}

async function fetchTypesPackageVersion(
  typesPackageName: string
): Promise<string | null> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(typesPackageName)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) return null

  const data = (await response.json()) as NpmInfo
  return data['dist-tags']?.latest ?? null
}

async function detectTypesSupport(
  manifest: PackageManifestLike,
  packageName: string
): Promise<TypesSupportInfo> {
  if (hasBundledTypes(manifest)) {
    return { status: 'bundled' }
  }

  if (packageName.startsWith('@types/')) {
    return { status: 'types-package' }
  }

  const typesPackageName = toTypesPackageName(packageName)
  const latestTypesVersion = await fetchTypesPackageVersion(typesPackageName)
  if (latestTypesVersion) {
    return {
      status: 'types-package',
      typesPackageName,
      latestTypesVersion,
    }
  }

  return { status: 'none' }
}

function formatTypesSupport(info: TypesSupportInfo): string {
  if (info.status === 'bundled') return 'bundled in package'
  if (info.status === 'types-package') {
    if (!info.typesPackageName) return '@types package'
    if (!info.latestTypesVersion) return `${info.typesPackageName} available`
    return `${info.typesPackageName}@${info.latestTypesVersion}`
  }
  return 'none'
}

function parseRepositoryUrl(
  repository: string | { url?: string } | undefined
): string | undefined {
  if (!repository) return undefined
  const raw = typeof repository === 'string' ? repository : repository.url
  if (!raw) return undefined

  return raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/^git@github\.com:/, 'https://github.com/')
    .replace(/\.git$/, '')
}

function formatSize(bytes: number | undefined): string {
  if (!bytes || Number.isNaN(bytes)) return 'unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function printDeps(deps: Record<string, string> | undefined): void {
  const entries = Object.entries(deps ?? {}).sort(([ a ], [ b ]) =>
    a.localeCompare(b)
  )
  console.log('')
  console.log(paint(`dependencies (${entries.length}):`, C.purple))
  if (entries.length === 0) {
    console.log(`${paint('•', C.pink)} none`)
    return
  }
  for (const [ name, version ] of entries) {
    console.log(`${paint('•', C.pink)} ${name}: ${paint(version, C.dim)}`)
  }
}

function printDist(versionData: NpmVersionData): void {
  const dist = versionData.dist
  if (!dist) return
  console.log('')
  console.log(paint('dist', C.purple))
  if (dist.tarball)
    console.log(` ${paint('·', C.pink)} tarball: ${dist.tarball}`)
  if (dist.shasum) console.log(` ${paint('·', C.pink)} shasum: ${dist.shasum}`)
  if (dist.integrity)
    console.log(` ${paint('·', C.pink)} integrity: ${dist.integrity}`)
  console.log(
    ` ${paint('·', C.pink)} unpackedSize: ${formatSize(dist.unpackedSize)}`
  )
}

function printDistTags(tags: Record<string, string> | undefined): void {
  const entries = Object.entries(tags ?? {})
  if (entries.length === 0) return
  console.log('')
  console.log(paint('dist-tags:', C.purple))
  for (const [ tag, value ] of entries) {
    console.log(`${paint(tag, C.pink)}: ${value}`)
  }
}

function printMaintainers(
  maintainers: NpmMaintainer[] | undefined,
  fallback: NpmMaintainer[] | undefined
): void {
  const list = maintainers && maintainers.length > 0 ? maintainers : fallback
  if (!list || list.length === 0) return
  console.log('')
  console.log(paint('maintainers:', C.purple))
  for (const maintainer of list) {
    const email = maintainer.email ? ` <${maintainer.email}>` : ''
    console.log(`${paint('•', C.pink)} ${maintainer.name}${email}`)
  }
}

export async function runInfo(
  packageName: string,
  useSelf: boolean = false
): Promise<void> {
  if (useSelf) {
    const cwd = process.cwd()
    const tsPath = resolve(cwd, 'package.ts')
    const jsonPath = resolve(cwd, 'package.json')

    let data: any

    if (existsSync(tsPath)) {
      const mod = await import(pathToFileURL(tsPath).href)
      data = mod.default ?? mod
    } else if (existsSync(jsonPath)) {
      const raw = await readFile(jsonPath, 'utf8')
      data = JSON.parse(raw)
    } else {
      throw new Error(
        'No package.ts or package.json found in current directory'
      )
    }

    await printLocalInfo(data)
    return
  }

  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch package info for ${packageName}`)
  }

  const data = (await response.json()) as NpmInfo
  await printRemoteInfo(data)
}

async function printLocalInfo(data: Record<string, unknown>): Promise<void> {
  const dependencies = normalizeDeps(data.dependencies)
  const depCount = Object.keys(dependencies).length
  const license = asString(data.license) ?? 'unknown'
  const description = asString(data.description) ?? ''
  const repository =
    asString(data.repository) ??
    (() => {
      const repositoryRecord = asRecord(data.repository)
      const repositoryUrl = asString(repositoryRecord?.url)
      return repositoryUrl ? { url: repositoryUrl } : undefined
    })()
  const link = asString(data.homepage) ?? parseRepositoryUrl(repository)
  const keywords = asStringArray(data.keywords)
  const version = asString(data.version) ?? '0.0.0'
  const packageName = typeof data.name === 'string' ? data.name : 'unknown'
  const moduleSystem = detectModuleSystem(data)
  const typesSupport = await detectTypesSupport(data, packageName)
  const npmxLink =
    packageName !== 'unknown'
      ? `https://npmx.dev/${encodeURIComponent(packageName)}`
      : null

  console.log(
    `${paint(`${packageName}@${version}`, C.bold + C.pink)} ${paint('|', C.dim)} ${paint(license, C.lavender)} ${paint('|', C.dim)} deps: ${depCount}`
  )

  if (description) console.log(description)
  if (link) console.log(paint(String(link), C.purple))
  if (npmxLink) console.log(paint(npmxLink, C.purple))
  console.log(
    `${paint('types:', C.purple)} ${formatTypesSupport(typesSupport)}`
  )
  console.log(`${paint('module:', C.purple)} ${moduleSystem}`)
  if (keywords.length > 0) {
    console.log(`${paint('keywords:', C.purple)} ${keywords.join(', ')}`)
  }

  printDeps(dependencies)
}

async function printRemoteInfo(data: NpmInfo): Promise<void> {
  const tags = data['dist-tags'] ?? {}
  const latest = tags.latest
  if (!latest || !data.versions?.[latest]) {
    throw new Error(`No latest version found for ${data.name}`)
  }

  const latestData = data.versions[latest]
  const dependencies = latestData.dependencies ?? {}
  const depCount = Object.keys(dependencies).length
  const versionCount = Object.keys(data.versions ?? {}).length
  const license = latestData.license ?? data.license ?? 'unknown'
  const description = latestData.description ?? data.description ?? ''
  const link = data.homepage ?? parseRepositoryUrl(data.repository)
  const keywords = data.keywords ?? []
  const published = data.time?.[latest]
  const moduleSystem = detectModuleSystem(latestData)
  const typesSupport = await detectTypesSupport(latestData, data.name)
  const npmxLink = `https://npmx.dev/${encodeURIComponent(data.name)}`

  console.log(
    `${paint(`${data.name}@${latest}`, C.bold + C.pink)} ${paint('|', C.dim)} ${paint(license, C.lavender)} ${paint('|', C.dim)} deps: ${depCount} ${paint('|', C.dim)} versions: ${versionCount}`
  )

  if (description) console.log(description)
  if (link) console.log(paint(link, C.purple))
  console.log(paint(npmxLink, C.purple))
  console.log(
    `${paint('types:', C.purple)} ${formatTypesSupport(typesSupport)}`
  )
  console.log(`${paint('module:', C.purple)} ${moduleSystem}`)
  if (keywords.length > 0) {
    console.log(`${paint('keywords:', C.purple)} ${keywords.join(', ')}`)
  }

  printDeps(dependencies)
  printDist(latestData)
  printDistTags(tags)
  printMaintainers(latestData.maintainers, data.maintainers)

  if (published) {
    console.log('')
    console.log(`${paint('Published:', C.purple)} ${published}`)
  }
}
