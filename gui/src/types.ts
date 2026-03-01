export interface ProjectRecord {
  path: string
  addedAt: string
}

export interface QuickLocation {
  id: string
  name: string
  path: string
  icon: string
}

export interface FsEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface TreeNode extends FsEntry {
  expanded: boolean
  loading: boolean
  loaded: boolean
  children: TreeNode[]
}

export interface DependencyCounts {
  dependencies: number
  devDependencies: number
  peerDependencies: number
  optionalDependencies: number
}

export interface ProjectInfo {
  path: string
  name: string
  version: string | null
  description: string | null
  packageManager: string
  altPms: string[]
  hasPackageJson: boolean
  hasPackageTs: boolean
  lockfiles: string[]
  scripts: string[]
  dependencyCounts: DependencyCounts
}

export interface PackageEntry {
  name: string
  version: string
}

export interface PackageSection {
  section:
    | 'dependencies'
    | 'devDependencies'
    | 'peerDependencies'
    | 'optionalDependencies'
  entries: PackageEntry[]
}

export interface GraphNode {
  id: string
  label: string
  packageName?: string | null
  version?: string | null
  scope?: string | null
  sizeBytes?: number | null
}

export interface GraphEdge {
  from: string
  to: string
}

export interface DependencyGraph {
  source: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface RegistryPackage {
  name: string
  version: string
  description: string
  updatedAt: string | null
  publisher: string | null
  npmUrl: string
  keywords: string[]
}

export interface CommandResult {
  id: string
  args: string[]
  command: string
  exitCode: number
  stdout: string
  stderr: string
  createdAt: string
  label: string
}

export interface CommandRequest {
  label: string
  args: string[]
  stdin?: string
  path?: string
}
