import { copyFile, readdir, unlink } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  BunPm,
  DenoPm,
  NpmPm,
  PnpmPm,
  YarnPm,
  syncDependencies,
  writePackageJson,
  type DependenciesInput,
  type PackageConfig,
} from '@opk/ts-pkg'
import { exists } from './fs'
import type { PmSelection } from '../types'
import { C, paint } from '../ui/colors.ts'

export async function loadConfig(
  configPath: string = 'package.ts'
): Promise<PackageConfig> {
  const absolute = resolve(process.cwd(), configPath)
  const rawConfig = await importConfigFile(absolute)
  const config = await resolveExtendedConfig(rawConfig, absolute, new Set([absolute]))
  if (!config.pm) {
    throw new Error(
      `Missing required pm field in ${configPath}. Import a PM from @opk/ts-pkg and assign pm`
    )
  }
  return config
}

async function importConfigFile(absolutePath: string): Promise<PackageConfig> {
  const extension = extname(absolutePath) || '.ts'
  const baseName = basename(absolutePath, extension)
  const nonce = `${process.pid}_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const tempPath = resolve(
    dirname(absolutePath),
    `.${baseName}.opk-${nonce}${extension}`
  )
  await copyFile(absolutePath, tempPath)

  try {
    const mod = await import(pathToFileURL(tempPath).href)
    return (mod.default ?? mod) as PackageConfig
  } finally {
    await unlink(tempPath).catch(() => undefined)
  }
}

async function resolveExtendedConfig(
  config: PackageConfig,
  sourcePath: string | null,
  visitedPaths: Set<string>
): Promise<PackageConfig> {
  if (!config.extends) {
    return config
  }

  let parent: PackageConfig
  if (typeof config.extends === 'string') {
    if (isPathLike(config.extends)) {
      if (!sourcePath) {
        throw new Error(`Cannot resolve relative extends path: ${config.extends}`)
      }
      const parentPath = await resolveExtendsPath(sourcePath, config.extends)
      if (visitedPaths.has(parentPath)) {
        throw new Error(`Circular package.ts extends chain detected at ${parentPath}`)
      }
      const nextVisited = new Set(visitedPaths)
      nextVisited.add(parentPath)
      parent = await resolveExtendedConfig(
        await importConfigFile(parentPath),
        parentPath,
        nextVisited
      )
    } else {
      const imported = await import(config.extends)
      parent = await resolveExtendedConfig(
        (imported.default ?? imported) as PackageConfig,
        null,
        visitedPaths
      )
    }
  } else {
    parent = await resolveExtendedConfig(config.extends, sourcePath, visitedPaths)
  }

  const { extends: _ignored, ...child } = config
  return mergePackageConfig(parent, child as PackageConfig)
}

async function resolveExtendsPath(
  sourcePath: string,
  extendsPath: string
): Promise<string> {
  const base = resolve(dirname(sourcePath), extendsPath)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    resolve(base, 'package.ts'),
    resolve(base, 'index.ts'),
  ]

  for (const candidate of candidates) {
    if (await exists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Unable to resolve extended package config '${extendsPath}' from ${sourcePath}`
  )
}

function mergePackageConfig(
  parent: PackageConfig,
  child: PackageConfig
): PackageConfig {
  return {
    ...parent,
    ...child,
    dependencies: mergeDependencies(parent.dependencies, child.dependencies),
    devDependencies: mergeDependencies(
      parent.devDependencies,
      child.devDependencies
    ),
    peerDependencies: mergeDependencies(
      parent.peerDependencies,
      child.peerDependencies
    ),
    scripts: { ...(parent.scripts ?? {}), ...(child.scripts ?? {}) },
    scriptPresets: [
      ...(parent.scriptPresets ?? []),
      ...(child.scriptPresets ?? []),
    ],
  }
}

function mergeDependencies(
  parent: DependenciesInput | undefined,
  child: DependenciesInput | undefined
): DependenciesInput | undefined {
  if (!parent && !child) return undefined
  if (!parent) return child
  if (!child) return parent

  if (Array.isArray(parent) && Array.isArray(child)) {
    return [...parent, ...child]
  }
  if (!Array.isArray(parent) && !Array.isArray(child)) {
    return { ...parent, ...child }
  }

  const parentArray = Array.isArray(parent) ? parent : []
  const childArray = Array.isArray(child) ? child : []
  const parentObject = Array.isArray(parent) ? {} : parent
  const childObject = Array.isArray(child) ? {} : child
  return [...parentArray, ...childArray, { ...parentObject, ...childObject }]
}

function isPathLike(value: string): boolean {
  return (
    value.startsWith('./') ||
    value.startsWith('../') ||
    value.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(value)
  )
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
  let config = await loadConfig(configPath)
  if (await shouldFormatPackageTs(config.scripts)) {
    await runPrettierWritePackageTs()
    config = await loadConfig(configPath)
  }
  await writePackageJson(config, { outputPath: packageJsonPath })
}

export async function shouldFormatPackageTs(
  scripts: Record<string, string> | undefined
): Promise<boolean> {
  if (hasPrettierInScripts(scripts)) {
    return true
  }
  return hasPrettierRcInProjectRoot()
}

function hasPrettierInScripts(
  scripts: Record<string, string> | undefined
): boolean {
  if (!scripts) {
    return false
  }
  const keys = Object.keys(scripts).some(key =>
    key.toLowerCase().includes('prettier')
  )
  const values = Object.values(scripts).some(value =>
    value.toLowerCase().includes('prettier')
  )
  return keys || values
}

async function hasPrettierRcInProjectRoot(): Promise<boolean> {
  const entries = await readdir(process.cwd())
  return entries.some(entry => entry.startsWith('.prettierrc'))
}

export async function runPrettierWritePackageTs(): Promise<void> {
  console.log(paint('Formatted: ', C.purple))
  const proc = Bun.spawn(['sh', '-lc', 'prettier --write package.ts'], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  await proc.exited
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
      lockfile: 'deno.lock',
      select: { importName: 'DenoPm', manager: DenoPm },
    },
    // npm lockfile comes last so non-npm lockfiles win when both are present.
    {
      lockfile: 'package-lock.json',
      select: { importName: 'NpmPm', manager: NpmPm },
    },
  ]

  for (const entry of selections) {
    if (await exists(resolve(process.cwd(), entry.lockfile))) {
      return entry.select
    }
  }

  return { importName: 'BunPm', manager: BunPm }
}
