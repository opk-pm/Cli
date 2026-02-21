import type { PackageManager } from '@opk/ts-pkg'

export type ModuleType = 'module' | 'commonjs'

export interface PmSelection {
  importName: 'BunPm' | 'NpmPm' | 'PnpmPm' | 'YarnPm' | 'DenoPm'
  manager: PackageManager
}

export interface PackageJsonSummary {
  name?: string
  version?: string
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}
