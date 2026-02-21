import { C, paint } from '../ui/colors'

interface NpmMaintainer {
  name: string
  email?: string
}

interface NpmVersionData {
  description?: string
  license?: string
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
  const entries = Object.entries(deps ?? {}).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  console.log('')
  console.log(paint(`dependencies (${entries.length}):`, C.purple))
  if (entries.length === 0) {
    console.log(`${paint('•', C.pink)} none`)
    return
  }
  for (const [name, version] of entries) {
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
  for (const [tag, value] of entries) {
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

export async function runInfo(packageName: string): Promise<void> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
  const response = await fetch(url, { headers: { Accept: 'application/json' } })

  if (!response.ok) {
    throw new Error(`Failed to fetch package info for ${packageName}`)
  }

  const data = (await response.json()) as NpmInfo
  const tags = data['dist-tags'] ?? {}
  const latest = tags.latest
  if (!latest || !data.versions?.[latest]) {
    throw new Error(`No latest version found for ${packageName}`)
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

  console.log(
    `${paint(`${data.name}@${latest}`, C.bold + C.pink)} ${paint('|', C.dim)} ${paint(license, C.lavender)} ${paint('|', C.dim)} deps: ${depCount} ${paint('|', C.dim)} versions: ${versionCount}`
  )
  if (description) console.log(description)
  if (link) console.log(paint(link, C.purple))
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
