import type {
  CommandRequest,
  DependencyGraph,
  FsEntry,
  PackageSection,
  ProjectInfo,
  ProjectRecord,
  QuickLocation,
  RegistryPackage,
} from '@/types'

interface ApiErrorPayload {
  error?: string
}

interface LegacyRunPayload {
  result: {
    args: string[]
    command: string
    exitCode: number
    stdout: string
    stderr: string
    createdAt: string
  }
}

interface CommandStreamMetaEvent {
  type: 'meta'
  args: string[]
  command: string
  createdAt: string
}

interface CommandStreamChunkEvent {
  type: 'stdout' | 'stderr'
  chunk: string
}

interface CommandStreamExitEvent {
  type: 'exit'
  exitCode: number
}

interface CommandStreamErrorEvent {
  type: 'error'
  message: string
}

type CommandStreamEvent =
  | CommandStreamMetaEvent
  | CommandStreamChunkEvent
  | CommandStreamExitEvent
  | CommandStreamErrorEvent

export interface CommandStreamHandlers {
  onMeta?: (event: CommandStreamMetaEvent) => void
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
  onExit?: (exitCode: number) => void
  onError?: (message: string) => void
}

export interface CommandStreamOptions {
  signal?: AbortSignal
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const errorPayload = (await response.json()) as ApiErrorPayload
      if (errorPayload.error) {
        message = errorPayload.error
      }
    } catch {
      // noop
    }
    throw new Error(message)
  }

  return (await response.json()) as T
}

export async function getProjects(): Promise<ProjectRecord[]> {
  const payload = await request<{ projects: ProjectRecord[] }>('/projects')
  return payload.projects
}

export async function addProject(path: string): Promise<ProjectRecord> {
  const payload = await request<{ project: ProjectRecord }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ path }),
  })
  return payload.project
}

export async function removeProject(path: string): Promise<ProjectRecord[]> {
  const payload = await request<{ projects: ProjectRecord[] }>('/projects', {
    method: 'DELETE',
    body: JSON.stringify({ path }),
  })
  return payload.projects
}

export async function getQuickLocations(): Promise<QuickLocation[]> {
  const payload = await request<{ locations: QuickLocation[] }>(
    '/fs/quick-locations'
  )
  return payload.locations
}

export async function listFolders(path: string): Promise<FsEntry[]> {
  const query = new URLSearchParams({ path }).toString()
  const payload = await request<{ entries: FsEntry[] }>(`/fs/list?${query}`)
  return payload.entries
}

export async function getProjectInfo(path: string): Promise<ProjectInfo> {
  const query = new URLSearchParams({ path }).toString()
  const payload = await request<{ info: ProjectInfo }>(`/project/info?${query}`)
  return payload.info
}

export async function getProjectPackages(
  path: string
): Promise<PackageSection[]> {
  const query = new URLSearchParams({ path }).toString()
  const payload = await request<{ packages: PackageSection[] }>(
    `/project/packages?${query}`
  )
  return payload.packages
}

export async function getDependencyGraph(
  path: string
): Promise<DependencyGraph> {
  const query = new URLSearchParams({ path }).toString()
  const payload = await request<{ graph: DependencyGraph }>(
    `/project/graph?${query}`
  )
  return payload.graph
}

export async function getRegistryPackages(
  query: string,
  size: number = 40
): Promise<RegistryPackage[]> {
  const params = new URLSearchParams({
    q: query,
    size: `${size}`,
  })
  const payload = await request<{ packages: RegistryPackage[] }>(
    `/registry/packages?${params.toString()}`
  )
  return payload.packages
}

export async function runOpkCommandStream(
  path: string,
  command: CommandRequest,
  handlers: CommandStreamHandlers,
  options?: CommandStreamOptions
): Promise<void> {
  const response = await fetch('/api/opk/run?stream=1', {
    method: 'POST',
    signal: options?.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path,
      args: command.args,
      stdin: command.stdin ?? '',
    }),
  })

  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const payload = (await response.json()) as ApiErrorPayload
      if (payload.error) {
        message = payload.error
      }
    } catch {
      // noop
    }
    throw new Error(message)
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase()
  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as LegacyRunPayload
    handlers.onMeta?.({
      type: 'meta',
      args: payload.result.args,
      command: payload.result.command,
      createdAt: payload.result.createdAt,
    })
    if (payload.result.stdout) {
      handlers.onStdout?.(payload.result.stdout)
    }
    if (payload.result.stderr) {
      handlers.onStderr?.(payload.result.stderr)
    }
    handlers.onExit?.(payload.result.exitCode)
    return
  }

  if (!response.body) {
    throw new Error('Command stream did not return a readable body')
  }

  await readNdjsonStream(response.body, handlers)
}

async function readNdjsonStream(
  stream: ReadableStream<Uint8Array>,
  handlers: CommandStreamHandlers
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let newlineIndex = buffer.indexOf('\n')
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      handleStreamLine(line, handlers)
      newlineIndex = buffer.indexOf('\n')
    }
  }

  const tail = `${buffer}${decoder.decode()}`.trim()
  if (tail) {
    handleStreamLine(tail, handlers)
  }
}

function handleStreamLine(line: string, handlers: CommandStreamHandlers): void {
  if (!line) return

  let payload: CommandStreamEvent
  try {
    payload = JSON.parse(line) as CommandStreamEvent
  } catch {
    handlers.onStdout?.(line)
    return
  }

  if (payload.type === 'meta') {
    handlers.onMeta?.(payload)
    return
  }
  if (payload.type === 'stdout') {
    handlers.onStdout?.(payload.chunk)
    return
  }
  if (payload.type === 'stderr') {
    handlers.onStderr?.(payload.chunk)
    return
  }
  if (payload.type === 'error') {
    handlers.onError?.(payload.message)
    return
  }
  if (payload.type === 'exit') {
    handlers.onExit?.(payload.exitCode)
  }
}
