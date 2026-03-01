import type {
  CommandRequest,
  CommandResult,
  DependencyGraph,
  FsEntry,
  PackageSection,
  ProjectInfo,
  ProjectRecord,
  RegistryPackage,
  QuickLocation,
} from '@/types'

interface ApiErrorPayload {
  error?: string
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

export async function runOpkCommand(
  path: string,
  command: CommandRequest
): Promise<CommandResult> {
  const payload = await request<{
    result: Omit<CommandResult, 'id' | 'label'>
  }>('/opk/run', {
    method: 'POST',
    body: JSON.stringify({
      path,
      args: command.args,
      stdin: command.stdin ?? '',
    }),
  })

  return {
    id: crypto.randomUUID(),
    label: command.label,
    ...payload.result,
  }
}
