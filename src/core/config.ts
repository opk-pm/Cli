import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  BunPm,
  DenoPm,
  NpmPm,
  PnpmPm,
  YarnPm,
  syncDependencies,
  writePackageJson,
  type PackageConfig,
} from '@opk/ts-pkg'
import { exists } from './fs'
import type { PmSelection } from '../types'

export async function loadConfig(
  configPath: string = 'package.ts'
): Promise<PackageConfig> {
  const absolute = resolve(process.cwd(), configPath)
  const mod = await import(pathToFileURL(absolute).href)
  const config = (mod.default ?? mod) as PackageConfig
  if (!config.pm) {
    throw new Error(
      `Missing required pm field in ${configPath}. Import a PM from @opk/ts-pkg and assign pm`
    )
  }
  return config
}

export async function syncAndGenerate(
  configPath: string = 'package.ts',
  packageJsonPath: string = 'package.json'
): Promise<void> {
  await syncDependencies({
    configPath,
    packageJsonPath,
    quiet: true,
  })
  const config = await loadConfig(configPath)
  await writePackageJson(config, { outputPath: packageJsonPath })
}

export async function detectPmSelection(): Promise<PmSelection> {
  const selections: Array<{ lockfile: string; select: PmSelection }> = [
    { lockfile: 'bun.lock', select: { importName: 'BunPm', manager: BunPm } },
    { lockfile: 'bun.lockb', select: { importName: 'BunPm', manager: BunPm } },
    {
      lockfile: 'pnpm-lock.yaml',
      select: { importName: 'PnpmPm', manager: PnpmPm },
    },
    {
      lockfile: 'yarn.lock',
      select: { importName: 'YarnPm', manager: YarnPm },
    },
    {
      lockfile: 'package-lock.json',
      select: { importName: 'NpmPm', manager: NpmPm },
    },
    {
      lockfile: 'deno.lock',
      select: { importName: 'DenoPm', manager: DenoPm },
    },
  ]

  for (const entry of selections) {
    if (await exists(resolve(process.cwd(), entry.lockfile))) {
      return entry.select
    }
  }

  return { importName: 'BunPm', manager: BunPm }
}
