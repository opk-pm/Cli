import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { basename, resolve } from 'node:path'

import type { Connect } from 'vite'

interface ApiOptions {
  repoRoot: string
}

interface ProjectRecord {
  path: string
  addedAt: string
}

interface LockGraphNode {
  id: string
  label: string
  packageName: string | null
  version: string | null
  scope: string | null
  sizeBytes: number | null
}

interface LockGraphEdge {
  from: string
  to: string
}

interface RegistryPackageSummary {
  name: string
  version: string
  description: string
  updatedAt: string | null
  publisher: string | null
  npmUrl: string
  keywords: string[]
}

class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const LOCKFILE_NAMES = [
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'deno.lock',
]

const PROJECT_STORE_PATH = resolve(homedir(), '.opk', 'gui-projects.json')
const MAX_GRAPH_NODES = 300
const MAX_GRAPH_DEPTH = 4

type JsonBody = Record<string, unknown>

export function createOpkApiMiddleware(
  options: ApiOptions
): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (!req.url?.startsWith('/api/')) {
      next()
      return
    }

    void handleApi(req, res, next, options).catch(error => {
      const status =
        error instanceof ApiError
          ? error.status
          : error instanceof Error && 'status' in error
            ? Number((error as { status: unknown }).status)
            : 500
      const message = error instanceof Error ? error.message : 'Unknown error'
      sendJson(res, status || 500, { error: message })
    })
  }
}

async function handleApi(
  req: IncomingMessage,
  res: ServerResponse,
  next: Connect.NextFunction,
  options: ApiOptions
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const key = `${req.method?.toUpperCase() ?? 'GET'} ${url.pathname}`

  switch (key) {
    case 'GET /api/health':
      sendJson(res, 200, { ok: true })
      return
    case 'GET /api/projects':
      await handleGetProjects(res)
      return
    case 'POST /api/projects':
      await handleAddProject(req, res)
      return
    case 'DELETE /api/projects':
      await handleRemoveProject(req, res)
      return
    case 'GET /api/fs/quick-locations':
      await handleQuickLocations(res, options)
      return
    case 'GET /api/fs/list':
      await handleListFs(url, res)
      return
    case 'GET /api/project/info':
      await handleProjectInfo(url, res)
      return
    case 'GET /api/project/packages':
      await handleProjectPackages(url, res)
      return
    case 'GET /api/project/graph':
      await handleProjectGraph(url, res)
      return
    case 'GET /api/registry/packages':
      await handleRegistryPackages(url, res)
      return
    case 'POST /api/opk/run':
      await handleRunOpk(req, res, options)
      return
    default:
      next()
      return
  }
}

async function handleGetProjects(res: ServerResponse): Promise<void> {
  const projects = await readStoredProjects()
  sendJson(res, 200, { projects })
}

async function handleAddProject(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req)
  const projectPath = await parseDirectoryInput(body.path, 'path')
  const projects = await readStoredProjects()

  if (!projects.some(project => project.path === projectPath)) {
    projects.push({
      path: projectPath,
      addedAt: new Date().toISOString(),
    })
    await writeStoredProjects(projects)
  }

  sendJson(res, 200, {
    project: projects.find(project => project.path === projectPath),
    projects,
  })
}

async function handleRemoveProject(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await readJsonBody(req)
  const projectPath = await parseDirectoryInput(body.path, 'path')
  const projects = await readStoredProjects()
  const nextProjects = projects.filter(project => project.path !== projectPath)
  await writeStoredProjects(nextProjects)
  sendJson(res, 200, { projects: nextProjects })
}

async function handleQuickLocations(
  res: ServerResponse,
  options: ApiOptions
): Promise<void> {
  const home = homedir()
  const locations = [
    {
      id: 'home',
      name: 'Home',
      path: home,
      icon: 'solar:home-angle-bold-duotone',
    },
    {
      id: 'desktop',
      name: 'Desktop',
      path: resolve(home, 'Desktop'),
      icon: 'solar:widget-4-bold-duotone',
    },
    {
      id: 'documents',
      name: 'Documents',
      path: resolve(home, 'Documents'),
      icon: 'solar:document-bold-duotone',
    },
    {
      id: 'downloads',
      name: 'Downloads',
      path: resolve(home, 'Downloads'),
      icon: 'solar:download-bold-duotone',
    },
    {
      id: 'opk-repo',
      name: 'Opk Repo',
      path: options.repoRoot,
      icon: 'solar:code-bold-duotone',
    },
    {
      id: 'root',
      name: 'Computer',
      path: '/',
      icon: 'solar:laptop-bold-duotone',
    },
  ]

  const visible = (
    await Promise.all(
      locations.map(async location =>
        (await isDirectory(location.path)) ? location : null
      )
    )
  ).filter(Boolean)

  sendJson(res, 200, { locations: visible })
}

async function handleListFs(url: URL, res: ServerResponse): Promise<void> {
  const path = await parseDirectoryInput(url.searchParams.get('path'), 'path')
  const includeFiles = url.searchParams.get('includeFiles') === '1'
  const includeHidden = url.searchParams.get('includeHidden') === '1'

  const entries = await readdir(path, { withFileTypes: true })
  const mapped = entries
    .filter(entry => (includeHidden ? true : !entry.name.startsWith('.')))
    .filter(entry => (includeFiles ? true : entry.isDirectory()))
    .map(entry => ({
      name: entry.name,
      path: resolve(path, entry.name),
      isDirectory: entry.isDirectory(),
    }))
    .sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

  sendJson(res, 200, { entries: mapped })
}

async function handleProjectInfo(url: URL, res: ServerResponse): Promise<void> {
  const projectPath = await parseDirectoryInput(
    url.searchParams.get('path'),
    'path'
  )
  const packageJson = await readPackageJson(projectPath)
  const packageTs = await readOptionalText(resolve(projectPath, 'package.ts'))
  const lockfiles = await findLockfiles(projectPath)

  const dependencies = normalizeRecord(packageJson?.dependencies)
  const devDependencies = normalizeRecord(packageJson?.devDependencies)
  const peerDependencies = normalizeRecord(packageJson?.peerDependencies)
  const optionalDependencies = normalizeRecord(
    packageJson?.optionalDependencies
  )
  const scriptsRecord = asRecord(packageJson?.scripts)
  const scripts = scriptsRecord ? Object.keys(scriptsRecord) : []

  const info = {
    path: projectPath,
    name: packageJson?.name ?? basename(projectPath),
    version: packageJson?.version ?? null,
    description: packageJson?.description ?? null,
    packageManager: detectPrimaryPm(packageTs, lockfiles),
    altPms: detectAltPms(packageTs),
    hasPackageJson: packageJson !== null,
    hasPackageTs: packageTs !== null,
    lockfiles,
    scripts,
    dependencyCounts: {
      dependencies: Object.keys(dependencies).length,
      devDependencies: Object.keys(devDependencies).length,
      peerDependencies: Object.keys(peerDependencies).length,
      optionalDependencies: Object.keys(optionalDependencies).length,
    },
  }

  sendJson(res, 200, { info })
}

async function handleProjectPackages(
  url: URL,
  res: ServerResponse
): Promise<void> {
  const projectPath = await parseDirectoryInput(
    url.searchParams.get('path'),
    'path'
  )
  const packageJson = await readPackageJson(projectPath)

  const sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const

  const packages = sections.map(section => {
    const deps = normalizeRecord(packageJson?.[section])
    return {
      section,
      entries: Object.entries(deps)
        .map(([ name, version ]) => ({ name, version }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  })

  sendJson(res, 200, { packages })
}

async function handleProjectGraph(
  url: URL,
  res: ServerResponse
): Promise<void> {
  const projectPath = await parseDirectoryInput(
    url.searchParams.get('path'),
    'path'
  )
  const packageJson = await readPackageJson(projectPath)
  const graph = await buildDependencyGraph(projectPath, packageJson)
  sendJson(res, 200, { graph })
}

async function handleRegistryPackages(
  url: URL,
  res: ServerResponse
): Promise<void> {
  const query = (url.searchParams.get('q') ?? '').trim()
  const size = parseBoundedInt(url.searchParams.get('size'), 42, 8, 80)
  const packages = await fetchRegistryPackages(query, size)
  sendJson(res, 200, { packages })
}

async function handleRunOpk(
  req: IncomingMessage,
  res: ServerResponse,
  options: ApiOptions
): Promise<void> {
  const body = await readJsonBody(req)
  const projectPath = await parseDirectoryInput(body.path, 'path')
  const args = parseStringArray(body.args, 'args')
  if (args.length === 0) {
    throw new ApiError(400, 'args cannot be empty')
  }

  const stdin = asString(body.stdin) ?? ''
  const cliEntry = await resolveCliEntry(options.repoRoot)
  const { command, exitCode, stdout, stderr } = await runOpk(
    cliEntry,
    projectPath,
    args,
    stdin
  )

  sendJson(res, 200, {
    result: {
      args,
      command,
      exitCode,
      stdout,
      stderr,
      createdAt: new Date().toISOString(),
    },
  })
}

async function buildDependencyGraph(
  projectPath: string,
  packageJson: Record<string, unknown> | null
): Promise<{
  source: string
  nodes: LockGraphNode[]
  edges: LockGraphEdge[]
}> {
  const rootLabel = asString(packageJson?.name) ?? basename(projectPath)
  const nodes = new Map<string, LockGraphNode>([
    [
      'root',
      {
        id: 'root',
        label: rootLabel,
        packageName: null,
        version: null,
        scope: 'root',
        sizeBytes: null,
      },
    ],
  ])
  const packagePathsByNodeId = new Map<string, Set<string>>()
  const edges: LockGraphEdge[] = []
  const edgeSet = new Set<string>()

  const trackPackagePath = (id: string, packagePath: string): void => {
    if (!packagePath.trim()) return
    const fullPath = resolve(projectPath, packagePath)
    if (!packagePathsByNodeId.has(id)) {
      packagePathsByNodeId.set(id, new Set())
    }
    packagePathsByNodeId.get(id)?.add(fullPath)
  }

  const addNode = (
    name: string,
    version?: string | null,
    packagePath?: string
  ): string => {
    if (nodes.size >= MAX_GRAPH_NODES) {
      return 'root'
    }
    const normalizedVersion = version ?? null
    const id = normalizedVersion ? `${name}@${normalizedVersion}` : name
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        label: normalizedVersion ? `${name} (${normalizedVersion})` : name,
        packageName: name,
        version: normalizedVersion,
        scope: extractPackageScope(name),
        sizeBytes: null,
      })
    }
    if (packagePath) {
      trackPackagePath(id, packagePath)
    }
    return id
  }

  const addEdge = (from: string, to: string): void => {
    if (from === to) return
    const key = `${from}=>${to}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    edges.push({ from, to })
  }

  const packageLockPath = resolve(projectPath, 'package-lock.json')
  if (await fileExists(packageLockPath)) {
    try {
      const lock = JSON.parse(
        await readFile(packageLockPath, 'utf8')
      ) as Record<string, unknown>
      const dependencies = asRecord(lock.dependencies)
      if (dependencies) {
        walkPackageLockDeps(dependencies, 'root', 0, addNode, addEdge)
      } else {
        const packages = asRecord(lock.packages)
        if (packages) {
          for (const [ entryPath, meta ] of Object.entries(packages)) {
            if (!entryPath) continue
            if (nodes.size >= MAX_GRAPH_NODES) break
            const metaRecord = asRecord(meta)
            const version = asString(metaRecord?.version)
            const fallbackName = extractNameFromPackagePath(entryPath)
            const name = asString(metaRecord?.name) ?? fallbackName
            const id = addNode(name, version, entryPath)
            addEdge('root', id)
          }
        }
      }
      await enrichGraphNodeSizes(projectPath, nodes, packagePathsByNodeId)

      return {
        source: 'package-lock.json',
        nodes: Array.from(nodes.values()),
        edges,
      }
    } catch {
      return {
        source: 'package-lock.json',
        nodes: Array.from(nodes.values()),
        edges,
      }
    }
  }

  const bunLockPath = resolve(projectPath, 'bun.lock')
  if (await fileExists(bunLockPath)) {
    try {
      const lock = JSON.parse(await readFile(bunLockPath, 'utf8')) as Record<
        string,
        unknown
      >
      const packages = asRecord(lock.packages)
      if (packages) {
        for (const [ key, value ] of Object.entries(packages)) {
          if (nodes.size >= MAX_GRAPH_NODES) break
          const meta = Array.isArray(value) ? {} : (asRecord(value) ?? {})
          const name = extractNameFromSpec(key)
          const version = asString(meta.version)
          const id = addNode(name, version)
          addEdge('root', id)
        }
      }
      await enrichGraphNodeSizes(projectPath, nodes, packagePathsByNodeId)
      return {
        source: 'bun.lock',
        nodes: Array.from(nodes.values()),
        edges,
      }
    } catch {
      return {
        source: 'bun.lock',
        nodes: Array.from(nodes.values()),
        edges,
      }
    }
  }

  const fallbackSections = [
    packageJson?.dependencies,
    packageJson?.devDependencies,
    packageJson?.peerDependencies,
    packageJson?.optionalDependencies,
  ]

  for (const section of fallbackSections) {
    const deps = normalizeRecord(section)
    for (const [ name, version ] of Object.entries(deps)) {
      if (nodes.size >= MAX_GRAPH_NODES) break
      const id = addNode(name, version)
      addEdge('root', id)
    }
  }

  await enrichGraphNodeSizes(projectPath, nodes, packagePathsByNodeId)
  return {
    source: 'package.json',
    nodes: Array.from(nodes.values()),
    edges,
  }
}

function walkPackageLockDeps(
  deps: Record<string, unknown>,
  parentId: string,
  depth: number,
  addNode: (name: string, version?: string | null) => string,
  addEdge: (from: string, to: string) => void
): void {
  if (depth > MAX_GRAPH_DEPTH) return

  for (const [ name, rawMeta ] of Object.entries(deps)) {
    const meta = asRecord(rawMeta) ?? {}
    const version = asString(meta.version)
    const id = addNode(name, version)
    addEdge(parentId, id)
    const nested = asRecord(meta.dependencies)
    if (nested) {
      walkPackageLockDeps(nested, id, depth + 1, addNode, addEdge)
    }
  }
}

async function spawnAndCollect(
  command: string,
  args: string[],
  cwd: string,
  stdin: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return await new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, {
      cwd,
      env: process.env,
      stdio: [ 'pipe', 'pipe', 'pipe' ],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', chunk => {
      stdout += String(chunk)
    })
    child.stderr.on('data', chunk => {
      stderr += String(chunk)
    })

    child.on('error', error => {
      rejectPromise(
        new ApiError(500, `Failed to start command: ${error.message}`)
      )
    })

    child.on('close', exitCode => {
      resolvePromise({
        exitCode: exitCode ?? 1,
        stdout,
        stderr,
      })
    })

    if (stdin) {
      child.stdin.write(stdin)
    }
    child.stdin.end()
  })
}

async function runOpk(
  cliEntry: string,
  cwd: string,
  args: string[],
  stdin: string
): Promise<{
  command: string
  exitCode: number
  stdout: string
  stderr: string
}> {
  const commandArgs = [ 'run', cliEntry, ...args ]
  const result = await spawnAndCollect('bun', commandArgs, cwd, stdin)
  return {
    command: `bun ${commandArgs.join(' ')}`,
    ...result,
  }
}

async function resolveCliEntry(repoRoot: string): Promise<string> {
  const candidates = [
    resolve(repoRoot, 'dist/cli.js'),
    resolve(repoRoot, 'src/cli.ts'),
  ]
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return candidate
    }
  }
  throw new ApiError(
    500,
    'Unable to resolve CLI entrypoint. Build Opk first or run from the repository root.'
  )
}

async function parseDirectoryInput(
  value: unknown,
  fieldName: string
): Promise<string> {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${fieldName} is required`)
  }
  const path = resolve(value.trim())
  if (!(await isDirectory(path))) {
    throw new ApiError(400, `${fieldName} is not a directory: ${path}`)
  }
  return path
}

function parseBoundedInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

function parseStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, `${fieldName} must be an array of strings`)
  }
  return value
    .filter(item => typeof item === 'string')
    .map(item => String(item).trim())
    .filter(Boolean)
}

async function readStoredProjects(): Promise<ProjectRecord[]> {
  await ensureProjectStore()
  const raw = await readFile(PROJECT_STORE_PATH, 'utf8')
  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = []
  }

  if (!Array.isArray(parsed)) {
    return []
  }

  const records = parsed.filter(isProjectRecord).map(project => ({
    path: resolve(project.path),
    addedAt: project.addedAt,
  }))

  const valid = (
    await Promise.all(
      records.map(async project =>
        (await isDirectory(project.path)) ? project : null
      )
    )
  ).filter(Boolean) as ProjectRecord[]

  if (valid.length !== records.length) {
    await writeStoredProjects(valid)
  }

  return valid
}

async function writeStoredProjects(projects: ProjectRecord[]): Promise<void> {
  await ensureProjectStore()
  const unique = dedupeProjects(projects)
  await writeFile(
    PROJECT_STORE_PATH,
    `${JSON.stringify(unique, null, 2)}\n`,
    'utf8'
  )
}

function dedupeProjects(projects: ProjectRecord[]): ProjectRecord[] {
  const seen = new Set<string>()
  const sorted = [ ...projects ].sort((a, b) =>
    a.addedAt.localeCompare(b.addedAt)
  )

  return sorted.filter(project => {
    if (seen.has(project.path)) {
      return false
    }
    seen.add(project.path)
    return true
  })
}

async function ensureProjectStore(): Promise<void> {
  await mkdir(resolve(homedir(), '.opk'), { recursive: true })
  if (!(await fileExists(PROJECT_STORE_PATH))) {
    await writeFile(PROJECT_STORE_PATH, '[]\n', 'utf8')
  }
}

async function readPackageJson(
  projectPath: string
): Promise<Record<string, unknown> | null> {
  const packageJsonPath = resolve(projectPath, 'package.json')
  const text = await readOptionalText(packageJsonPath)
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return null
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  if (!(await fileExists(path))) {
    return null
  }
  return await readFile(path, 'utf8')
}

async function findLockfiles(projectPath: string): Promise<string[]> {
  const visible = await Promise.all(
    LOCKFILE_NAMES.map(async lockfile =>
      (await fileExists(resolve(projectPath, lockfile))) ? lockfile : null
    )
  )
  return visible.filter(Boolean) as string[]
}

function detectPrimaryPm(
  packageTs: string | null,
  lockfiles: string[]
): string {
  if (packageTs) {
    const match = packageTs.match(/\bpm\s*:\s*([A-Za-z_$][\w$]*)/)
    if (match?.[1]) {
      return match[1]
    }
  }

  if (lockfiles.includes('bun.lock') || lockfiles.includes('bun.lockb'))
    return 'Bun'
  if (lockfiles.includes('package-lock.json')) return 'npm'
  if (lockfiles.includes('pnpm-lock.yaml')) return 'pnpm'
  if (lockfiles.includes('yarn.lock')) return 'Yarn'
  if (lockfiles.includes('deno.lock')) return 'Deno'

  return 'Unknown'
}

function detectAltPms(packageTs: string | null): string[] {
  if (!packageTs) return []
  const match = packageTs.match(/\baltPms\s*:\s*\[([\s\S]*?)]/m)
  if (!match?.[1]) return []
  return Array.from(new Set(match[1].match(/[A-Za-z_$][\w$]*/g) ?? []))
}

async function fetchRegistryPackages(
  query: string,
  size: number
): Promise<RegistryPackageSummary[]> {
  const searchText = query || 'keywords:*'
  const endpoint = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(searchText)}&size=${size}&from=0`
  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new ApiError(
      502,
      `Failed to fetch registry packages (${response.status} ${response.statusText})`
    )
  }

  const payload = (await response.json()) as {
    objects?: Array<Record<string, unknown>>
  }
  const packages = (payload.objects ?? [])
    .map(item => toRegistrySummary(item))
    .filter(Boolean) as RegistryPackageSummary[]
  packages.sort((a, b) => dateScore(b.updatedAt) - dateScore(a.updatedAt))
  return packages
}

function normalizeRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([ , version ]) => typeof version === 'string')
    .map(([ name, version ]) => [ name, version as string ])
  return Object.fromEntries(entries)
}

function toRegistrySummary(
  item: Record<string, unknown>
): RegistryPackageSummary | null {
  const pkg = asRecord(item.package)
  if (!pkg) return null

  const name = asString(pkg.name)
  if (!name) return null

  const version = asString(pkg.version) ?? 'latest'
  const links = asRecord(pkg.links)
  const publisher = asRecord(pkg.publisher)
  const keywordsRaw = Array.isArray(pkg.keywords) ? pkg.keywords : []
  const keywords = keywordsRaw
    .filter(keyword => typeof keyword === 'string')
    .map(keyword => keyword.trim())
    .filter(Boolean)
    .slice(0, 8)
  const updatedAt = asString(item.updated) ?? asString(pkg.date) ?? null

  return {
    name,
    version,
    description: asString(pkg.description) ?? '',
    updatedAt,
    publisher:
      asString(publisher?.username) ??
      asString(publisher?.name) ??
      asString(publisher?.email) ??
      null,
    npmUrl: asString(links?.npm) ?? `https://www.npmjs.com/package/${name}`,
    keywords,
  }
}

function extractNameFromSpec(spec: string): string {
  const trimmed = spec.trim()
  if (trimmed.startsWith('@')) {
    const secondAt = trimmed.indexOf('@', 1)
    return secondAt > 0 ? trimmed.slice(0, secondAt) : trimmed
  }
  const at = trimmed.lastIndexOf('@')
  return at > 0 ? trimmed.slice(0, at) : trimmed
}

function extractNameFromPackagePath(pathValue: string): string {
  const parts = pathValue.split('node_modules/').filter(Boolean)
  return parts[parts.length - 1] ?? pathValue
}

function extractPackageScope(packageName: string): string | null {
  if (!packageName.startsWith('@')) return null
  const slash = packageName.indexOf('/')
  return slash > 1 ? packageName.slice(0, slash) : null
}

function resolveNodeModulesPackagePath(
  projectPath: string,
  packageName: string
): string {
  const segments = packageName.split('/').filter(Boolean)
  return resolve(projectPath, 'node_modules', ...segments)
}

async function enrichGraphNodeSizes(
  projectPath: string,
  nodes: Map<string, LockGraphNode>,
  packagePathsByNodeId: Map<string, Set<string>>
): Promise<void> {
  const sizeCache = new Map<string, number>()
  for (const node of nodes.values()) {
    if (node.id === 'root' || !node.packageName) continue

    let totalSize = 0
    const paths = packagePathsByNodeId.get(node.id)
    if (paths?.size) {
      for (const packagePath of paths) {
        totalSize += await calculatePathSize(packagePath, sizeCache)
      }
    }

    if (totalSize <= 0) {
      totalSize = await calculatePathSize(
        resolveNodeModulesPackagePath(projectPath, node.packageName),
        sizeCache
      )
    }

    node.sizeBytes = totalSize > 0 ? totalSize : null
  }
}

async function calculatePathSize(
  path: string,
  cache: Map<string, number>
): Promise<number> {
  if (cache.has(path)) {
    return cache.get(path) ?? 0
  }

  let total = 0
  try {
    const info = await stat(path)
    if (info.isFile()) {
      total = info.size
    } else if (info.isDirectory()) {
      const entries = await readdir(path, { withFileTypes: true })
      for (const entry of entries) {
        const childPath = resolve(path, entry.name)
        if (entry.isDirectory()) {
          total += await calculatePathSize(childPath, cache)
        } else if (entry.isFile()) {
          try {
            total += (await stat(childPath)).size
          } catch {
            // Ignore transient file errors while estimating size.
          }
        }
      }
    }
  } catch {
    total = 0
  }

  cache.set(path, total)
  return total
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }
  return value as Record<string, unknown>
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function dateScore(value: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isDirectory()
  } catch {
    return false
  }
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const record = value as Record<string, unknown>
  return typeof record.path === 'string' && typeof record.addedAt === 'string'
}

async function readJsonBody(req: IncomingMessage): Promise<JsonBody> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk))
  }

  if (chunks.length === 0) {
    return {}
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}

  try {
    const value = JSON.parse(raw) as unknown
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as JsonBody
    }
    throw new Error('JSON body must be an object')
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }
}

function sendJson(
  res: ServerResponse,
  status: number,
  payload: Record<string, unknown>
): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}
