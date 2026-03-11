import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { C, paint } from '@/ui/colors'

const DEFAULT_PORT = 1561
const PROJECT_STORE_PATH = resolve(homedir(), '.opk', 'gui-projects.json')
const LOCKFILE_NAMES = [
  'bun.lock',
  'bun.lockb',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'deno.lock',
]
const MAX_GRAPH_NODES = 280
const MAX_GRAPH_DEPTH = 4

interface ProjectRecord {
  path: string
  addedAt: string
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

interface GraphNode {
  id: string
  label: string
  packageName: string | null
  version: string | null
  scope: string | null
  sizeBytes: number | null
}

interface GuiRuntime {
  guiRoot: string
  repoRoot: string
  cliEntry: string
}

class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function runGui(args: string[]): Promise<void> {
  const port = parsePort(args)
  const runtime = await resolveGuiRuntime()
  const guiRoot = runtime?.guiRoot ?? null

  if (!guiRoot) {
    throw new Error(
      'GUI build not found. Run `bun run build` to build Opk and the GUI assets.'
    )
  }

  Bun.serve({
    port,
    fetch: async (request, server) => {
      const url = new URL(request.url)
      if (url.pathname.startsWith('/api/')) {
        server.timeout(request, url.pathname === '/api/opk/run' ? 0 : 60)
        return await handleApiRequest(request, runtime)
      }

      const requested = decodeURIComponent(url.pathname)
      const path = requested === '/' ? '/index.html' : requested
      const filePath = resolve(guiRoot, `.${path}`)

      if (!isPathInsideRoot(guiRoot, filePath)) {
        return new Response('Not found', { status: 404 })
      }

      const resolved = await resolveGuiFile(guiRoot, filePath)
      if (!resolved) {
        return new Response('Not found', { status: 404 })
      }

      const headers = new Headers({
        'Content-Type': getMimeType(resolved),
      })
      headers.set(
        'Cache-Control',
        resolved.endsWith('.html')
          ? 'no-store'
          : 'public, max-age=600, stale-while-revalidate=120'
      )

      return new Response(Bun.file(resolved), { headers })
    },
  })

  console.log(
    `${paint('Opk GUI running at', C.pink)} ${paint(`http://localhost:${port}`, C.lavender)}`
  )

  await new Promise(() => undefined)
}

function parsePort(args: string[]): number {
  let port = DEFAULT_PORT

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (!arg) continue

    if (arg === '--port' || arg === '-p') {
      const next = args[index + 1]
      if (!next) {
        throw new Error(`${arg} requires a value`)
      }
      port = parsePortValue(next)
      index += 1
      continue
    }

    if (arg.startsWith('--port=')) {
      port = parsePortValue(arg.slice('--port='.length))
      continue
    }

    if (/^\d+$/.test(arg)) {
      port = parsePortValue(arg)
      continue
    }

    throw new Error(`Unknown gui option: ${arg}`)
  }

  return port
}

function parsePortValue(raw: string): number {
  const port = Number.parseInt(raw, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port: ${raw}`)
  }
  return port
}

async function resolveGuiRuntime(): Promise<GuiRuntime> {
  const moduleDir = dirname(fileURLToPath(import.meta.url))
  const repoCandidates = unique([
    resolve(moduleDir, '..'),
    resolve(moduleDir, '../..'),
    resolve(moduleDir, '../../..'),
    process.cwd(),
  ])

  for (const repoRoot of repoCandidates) {
    const guiCandidates = unique([
      resolve(moduleDir, 'gui'),
      resolve(moduleDir, '../gui'),
      resolve(repoRoot, 'dist/gui'),
      resolve(repoRoot, 'gui/dist'),
      resolve(moduleDir, '../../dist/gui'),
      resolve(moduleDir, '../../gui/dist'),
    ])
    const cliCandidates = unique([
      resolve(moduleDir, 'cli.js'),
      resolve(moduleDir, '../cli.ts'),
      resolve(repoRoot, 'src/cli.ts'),
      resolve(repoRoot, 'dist/cli.js'),
    ])

    const guiRoot = await findFirstDirWithIndex(guiCandidates)
    const cliEntry = await findFirstExistingFile(cliCandidates)
    if (guiRoot && cliEntry) {
      return {
        guiRoot,
        repoRoot,
        cliEntry,
      }
    }
  }

  throw new Error(
    'Unable to resolve GUI runtime. Build Opk first so dist/gui and cli entry exist.'
  )
}

async function handleApiRequest(
  request: Request,
  runtime: GuiRuntime
): Promise<Response> {
  try {
    const url = new URL(request.url)
    const route = `${request.method.toUpperCase()} ${url.pathname}`

    switch (route) {
      case 'GET /api/health':
        return json(200, { ok: true })
      case 'GET /api/projects':
        return json(200, { projects: await readStoredProjects() })
      case 'POST /api/projects': {
        const body = await parseJsonBody(request)
        const projectPath = await parseDirectoryPath(body.path, 'path')
        const projects = await readStoredProjects()
        if (!projects.some(project => project.path === projectPath)) {
          projects.push({
            path: projectPath,
            addedAt: new Date().toISOString(),
          })
          await writeStoredProjects(projects)
        }
        return json(200, {
          project: projects.find(project => project.path === projectPath),
          projects,
        })
      }
      case 'DELETE /api/projects': {
        const body = await parseJsonBody(request)
        const projectPath = await parseDirectoryPath(body.path, 'path')
        const projects = await readStoredProjects()
        const next = projects.filter(project => project.path !== projectPath)
        await writeStoredProjects(next)
        return json(200, { projects: next })
      }
      case 'GET /api/fs/quick-locations':
        return json(200, {
          locations: await buildQuickLocations(runtime.repoRoot),
        })
      case 'GET /api/fs/list': {
        const dir = await parseDirectoryPath(
          url.searchParams.get('path'),
          'path'
        )
        const entries = await readdir(dir, { withFileTypes: true })
        const mapped = entries
          .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
          .map(entry => ({
            name: entry.name,
            path: resolve(dir, entry.name),
            isDirectory: true,
          }))
          .sort((a, b) => a.name.localeCompare(b.name))
        return json(200, { entries: mapped })
      }
      case 'GET /api/project/info': {
        const projectPath = await parseDirectoryPath(
          url.searchParams.get('path'),
          'path'
        )
        const packageJson = await readPackageJson(projectPath)
        const packageTs = await readOptionalText(
          resolve(projectPath, 'package.ts')
        )
        const lockfiles = await detectLockfiles(projectPath)

        const deps = normalizeDeps(packageJson?.dependencies)
        const devDeps = normalizeDeps(packageJson?.devDependencies)
        const peerDeps = normalizeDeps(packageJson?.peerDependencies)
        const optionalDeps = normalizeDeps(packageJson?.optionalDependencies)
        const scripts =
          packageJson?.scripts && typeof packageJson.scripts === 'object'
            ? Object.keys(packageJson.scripts as Record<string, unknown>)
            : []

        return json(200, {
          info: {
            path: projectPath,
            name: asString(packageJson?.name) ?? basename(projectPath),
            version: asString(packageJson?.version) ?? null,
            description: asString(packageJson?.description) ?? null,
            packageManager: detectPrimaryPm(packageTs, lockfiles),
            altPms: detectAltPms(packageTs),
            hasPackageJson: packageJson !== null,
            hasPackageTs: packageTs !== null,
            lockfiles,
            scripts,
            dependencyCounts: {
              dependencies: Object.keys(deps).length,
              devDependencies: Object.keys(devDeps).length,
              peerDependencies: Object.keys(peerDeps).length,
              optionalDependencies: Object.keys(optionalDeps).length,
            },
          },
        })
      }
      case 'GET /api/project/packages': {
        const projectPath = await parseDirectoryPath(
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
          const entries = Object.entries(normalizeDeps(packageJson?.[section]))
            .map(([ name, version ]) => ({ name, version }))
            .sort((a, b) => a.name.localeCompare(b.name))
          return { section, entries }
        })
        return json(200, { packages })
      }
      case 'GET /api/project/graph': {
        const projectPath = await parseDirectoryPath(
          url.searchParams.get('path'),
          'path'
        )
        const packageJson = await readPackageJson(projectPath)
        return json(200, {
          graph: await buildDependencyGraph(projectPath, packageJson),
        })
      }
      case 'GET /api/registry/packages': {
        const query = (url.searchParams.get('q') ?? '').trim()
        const size = parseBoundedInt(url.searchParams.get('size'), 42, 8, 80)
        return json(200, {
          packages: await fetchRegistryPackages(query, size),
        })
      }
      case 'POST /api/opk/run': {
        const body = await parseJsonBody(request)
        const projectPath = await parseDirectoryPath(body.path, 'path')
        const args = parseStringArray(body.args, 'args')
        if (args.length === 0) {
          throw new ApiError(400, 'args cannot be empty')
        }

        const stdin = asString(body.stdin) ?? ''
        const useStreaming = url.searchParams.get('stream') === '1'
        if (useStreaming) {
          return runOpkStream(
            runtime.cliEntry,
            projectPath,
            args,
            stdin,
            request.signal
          )
        }

        const result = await runOpk(runtime.cliEntry, projectPath, args, stdin)
        return json(200, {
          result: {
            args,
            command: result.command,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            createdAt: new Date().toISOString(),
          },
        })
      }
      default:
        return json(404, { error: `Unknown endpoint: ${url.pathname}` })
    }
  } catch (error) {
    if (error instanceof ApiError) {
      return json(error.status, { error: error.message })
    }
    const message = error instanceof Error ? error.message : String(error)
    return json(500, { error: message })
  }
}

async function resolveGuiFile(
  guiRoot: string,
  requestedFile: string
): Promise<string | null> {
  if (await isFile(requestedFile)) {
    return requestedFile
  }

  if (extname(requestedFile)) {
    return null
  }

  const indexPath = resolve(guiRoot, 'index.html')
  return (await isFile(indexPath)) ? indexPath : null
}

async function hasIndexHtml(path: string): Promise<boolean> {
  return isFile(resolve(path, 'index.html'))
}

async function isFile(path: string): Promise<boolean> {
  try {
    const info = await stat(path)
    return info.isFile()
  } catch {
    return false
  }
}

function getMimeType(path: string): string {
  const extension = extname(path).toLowerCase()
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8'
    case '.css':
      return 'text/css; charset=utf-8'
    case '.js':
      return 'application/javascript; charset=utf-8'
    case '.json':
      return 'application/json; charset=utf-8'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.woff':
      return 'font/woff'
    case '.woff2':
      return 'font/woff2'
    default:
      return 'application/octet-stream'
  }
}

function isPathInsideRoot(root: string, candidatePath: string): boolean {
  const rootWithSeparator = root.endsWith(sep) ? root : `${root}${sep}`
  return candidatePath === root || candidatePath.startsWith(rootWithSeparator)
}

async function buildQuickLocations(
  repoRoot: string
): Promise<Array<{ id: string; name: string; path: string; icon: string }>> {
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
      path: repoRoot,
      icon: 'solar:code-bold-duotone',
    },
    {
      id: 'root',
      name: 'Computer',
      path: '/',
      icon: 'solar:laptop-bold-duotone',
    },
  ]

  const visible = await Promise.all(
    locations.map(async location =>
      (await isDirectory(location.path)) ? location : null
    )
  )
  return visible.filter(Boolean) as Array<{
    id: string
    name: string
    path: string
    icon: string
  }>
}

async function runOpk(
  cliEntry: string,
  cwd: string,
  args: string[],
  stdin: string
): Promise<{
  exitCode: number
  stdout: string
  stderr: string
  command: string
}> {
  const commandArgs = [ 'run', cliEntry, ...args ]
  const command = `bun ${commandArgs.join(' ')}`

  const result = await new Promise<{
    exitCode: number
    stdout: string
    stderr: string
  }>((resolvePromise, rejectPromise) => {
    const child = spawn('bun', commandArgs, {
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
        new ApiError(500, `Failed to run opk command: ${error.message}`)
      )
    })
    child.on('close', code => {
      resolvePromise({
        exitCode: code ?? 1,
        stdout,
        stderr,
      })
    })

    if (stdin) {
      child.stdin.write(stdin)
    }
    child.stdin.end()
  })

  return { ...result, command }
}

function runOpkStream(
  cliEntry: string,
  cwd: string,
  args: string[],
  stdin: string,
  signal: AbortSignal
): Response {
  const commandArgs = [ 'run', cliEntry, ...args ]
  const command = `bun ${commandArgs.join(' ')}`
  const createdAt = new Date().toISOString()
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writeEvent = (payload: Record<string, unknown>): void => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }

      let child: ReturnType<typeof spawn>
      try {
        child = spawn('bun', commandArgs, {
          cwd,
          env: process.env,
          stdio: [ 'pipe', 'pipe', 'pipe' ],
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        writeEvent({ type: 'error', message: `Failed to run opk command: ${message}` })
        writeEvent({ type: 'exit', exitCode: 1 })
        controller.close()
        return
      }
      let ended = false

      const finish = (exitCode: number, errorMessage?: string): void => {
        if (ended) return
        if (errorMessage) {
          writeEvent({ type: 'error', message: errorMessage })
        }
        writeEvent({ type: 'exit', exitCode })
        ended = true
        controller.close()
      }

      writeEvent({
        type: 'meta',
        args,
        command,
        createdAt,
      })

      child.stdout?.on('data', chunk => {
        if (ended) return
        writeEvent({ type: 'stdout', chunk: String(chunk) })
      })
      child.stderr?.on('data', chunk => {
        if (ended) return
        writeEvent({ type: 'stderr', chunk: String(chunk) })
      })
      child.on('error', error => {
        finish(1, `Failed to run opk command: ${error.message}`)
      })
      child.on('close', code => {
        finish(code ?? 1)
      })

      signal.addEventListener('abort', () => {
        if (ended || child.killed) return
        child.kill('SIGTERM')
      })

      try {
        if (stdin) {
          child.stdin?.write(stdin)
        }
        child.stdin?.end()
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        finish(1, `Failed to stream command: ${message}`)
      }
    },
    cancel() {
      // noop
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
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

  const projects = parsed.filter(isProjectRecord).map(project => ({
    path: resolve(project.path),
    addedAt: project.addedAt,
  }))
  const valid = (
    await Promise.all(
      projects.map(async project =>
        (await isDirectory(project.path)) ? project : null
      )
    )
  ).filter(Boolean) as ProjectRecord[]

  if (valid.length !== projects.length) {
    await writeStoredProjects(valid)
  }

  return valid
}

async function writeStoredProjects(projects: ProjectRecord[]): Promise<void> {
  await ensureProjectStore()
  const deduped = dedupeProjects(projects)
  await writeFile(
    PROJECT_STORE_PATH,
    `${JSON.stringify(deduped, null, 2)}\n`,
    'utf8'
  )
}

function dedupeProjects(projects: ProjectRecord[]): ProjectRecord[] {
  const seen = new Set<string>()
  const ordered = [ ...projects ].sort((a, b) =>
    a.addedAt.localeCompare(b.addedAt)
  )
  return ordered.filter(project => {
    if (seen.has(project.path)) return false
    seen.add(project.path)
    return true
  })
}

async function ensureProjectStore(): Promise<void> {
  await mkdir(resolve(homedir(), '.opk'), { recursive: true })
  if (!(await exists(PROJECT_STORE_PATH))) {
    await writeFile(PROJECT_STORE_PATH, '[]\n', 'utf8')
  }
}

async function readPackageJson(
  projectPath: string
): Promise<Record<string, unknown> | null> {
  const content = await readOptionalText(resolve(projectPath, 'package.json'))
  if (!content) return null
  try {
    return JSON.parse(content) as Record<string, unknown>
  } catch {
    return null
  }
}

async function readOptionalText(path: string): Promise<string | null> {
  if (!(await exists(path))) {
    return null
  }
  return await readFile(path, 'utf8')
}

function normalizeDeps(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  const record = value as Record<string, unknown>
  const entries = Object.entries(record)
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

async function detectLockfiles(projectPath: string): Promise<string[]> {
  const states = await Promise.all(
    LOCKFILE_NAMES.map(async lockfile =>
      (await exists(resolve(projectPath, lockfile))) ? lockfile : null
    )
  )
  return states.filter(Boolean) as string[]
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

async function buildDependencyGraph(
  projectPath: string,
  packageJson: Record<string, unknown> | null
): Promise<{
  source: string
  nodes: GraphNode[]
  edges: Array<{ from: string; to: string }>
}> {
  const rootLabel = asString(packageJson?.name) ?? basename(projectPath)
  const nodes = new Map<string, GraphNode>([
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
  const edges: Array<{ from: string; to: string }> = []
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
  if (await exists(packageLockPath)) {
    try {
      const lock = JSON.parse(
        await readFile(packageLockPath, 'utf8')
      ) as Record<string, unknown>
      const dependencies = asRecord(lock.dependencies)
      if (dependencies) {
        walkPackageLock(dependencies, 'root', 0, addNode, addEdge)
      } else {
        const packages = asRecord(lock.packages)
        if (packages) {
          for (const [ entryPath, value ] of Object.entries(packages)) {
            if (!entryPath) continue
            if (nodes.size >= MAX_GRAPH_NODES) break
            const meta = asRecord(value)
            const name =
              asString(meta?.name) ?? extractNameFromNodeModulesPath(entryPath)
            const version = asString(meta?.version)
            const id = addNode(name, version, entryPath)
            addEdge('root', id)
          }
        }
      }
      await enrichGraphNodeSizes(projectPath, nodes, packagePathsByNodeId)
      return { source: 'package-lock.json', nodes: [ ...nodes.values() ], edges }
    } catch {
      return { source: 'package-lock.json', nodes: [ ...nodes.values() ], edges }
    }
  }

  const bunLockPath = resolve(projectPath, 'bun.lock')
  if (await exists(bunLockPath)) {
    try {
      const lock = JSON.parse(await readFile(bunLockPath, 'utf8')) as Record<
        string,
        unknown
      >
      const packages = asRecord(lock.packages)
      if (packages) {
        for (const [ spec, metaValue ] of Object.entries(packages)) {
          if (nodes.size >= MAX_GRAPH_NODES) break
          const meta = asRecord(metaValue)
          const name = extractNameFromSpec(spec)
          const version = asString(meta?.version)
          const id = addNode(name, version)
          addEdge('root', id)
        }
      }
      await enrichGraphNodeSizes(projectPath, nodes, packagePathsByNodeId)
      return { source: 'bun.lock', nodes: [ ...nodes.values() ], edges }
    } catch {
      return { source: 'bun.lock', nodes: [ ...nodes.values() ], edges }
    }
  }

  const fallback = [
    normalizeDeps(packageJson?.dependencies),
    normalizeDeps(packageJson?.devDependencies),
    normalizeDeps(packageJson?.peerDependencies),
    normalizeDeps(packageJson?.optionalDependencies),
  ]
  for (const group of fallback) {
    for (const [ name, version ] of Object.entries(group)) {
      if (nodes.size >= MAX_GRAPH_NODES) break
      const id = addNode(name, version)
      addEdge('root', id)
    }
  }

  await enrichGraphNodeSizes(projectPath, nodes, packagePathsByNodeId)
  return { source: 'package.json', nodes: [ ...nodes.values() ], edges }
}

function walkPackageLock(
  deps: Record<string, unknown>,
  parent: string,
  depth: number,
  addNode: (name: string, version?: string | null) => string,
  addEdge: (from: string, to: string) => void
): void {
  if (depth > MAX_GRAPH_DEPTH) return
  for (const [ name, value ] of Object.entries(deps)) {
    const meta = asRecord(value) ?? {}
    const version = asString(meta.version)
    const id = addNode(name, version)
    addEdge(parent, id)
    const nested = asRecord(meta.dependencies)
    if (nested) {
      walkPackageLock(nested, id, depth + 1, addNode, addEdge)
    }
  }
}

function extractNameFromNodeModulesPath(value: string): string {
  const parts = value.split('node_modules/').filter(Boolean)
  return parts[parts.length - 1] ?? value
}

function extractNameFromSpec(spec: string): string {
  const value = spec.trim()
  if (value.startsWith('@')) {
    const secondAt = value.indexOf('@', 1)
    return secondAt > 0 ? value.slice(0, secondAt) : value
  }
  const at = value.lastIndexOf('@')
  return at > 0 ? value.slice(0, at) : value
}

function extractPackageScope(packageName: string): string | null {
  if (!packageName.startsWith('@')) return null
  const splitAt = packageName.indexOf('/')
  return splitAt > 1 ? packageName.slice(0, splitAt) : null
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
  nodes: Map<string, GraphNode>,
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

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function dateScore(value: string | null): number {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function parseDirectoryPath(
  value: unknown,
  field: string
): Promise<string> {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(400, `${field} is required`)
  }

  const path = resolve(value.trim())
  if (!(await isDirectory(path))) {
    throw new ApiError(400, `${field} is not a directory: ${path}`)
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

function parseStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new ApiError(400, `${field} must be an array`)
  }
  return value
    .filter(item => typeof item === 'string')
    .map(item => String(item).trim())
    .filter(Boolean)
}

async function parseJsonBody(
  request: Request
): Promise<Record<string, unknown>> {
  const raw = (await request.text()).trim()
  if (!raw) return {}

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    throw new ApiError(400, 'Invalid JSON body')
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'JSON body must be an object')
  }

  return value as Record<string, unknown>
}

function json(status: number, payload: Record<string, unknown>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}

async function exists(path: string): Promise<boolean> {
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

async function findFirstDirWithIndex(
  candidates: string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    if (await hasIndexHtml(candidate)) {
      return candidate
    }
  }
  return null
}

async function findFirstExistingFile(
  candidates: string[]
): Promise<string | null> {
  for (const candidate of candidates) {
    if (await isFile(candidate)) {
      return candidate
    }
  }
  return null
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}
