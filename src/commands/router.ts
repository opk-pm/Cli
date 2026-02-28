import { resolve } from 'node:path'
import { writePackageJson, type PackageManager } from '@opk/ts-pkg'
import { detectPmSelection, loadConfig, syncAndGenerate } from '../core/config'
import { exists } from '../core/fs'
import { runPmCommand, runPmOnly } from '../core/shell'
import { runInit } from './init'
import { runInfo } from './info'
import { runMigrate } from './migrate'
import { runList } from '../ui/list'
import { C, paint } from '../ui/colors'
import { printHelp } from '../ui/help'

type PmCommand =
  | 'add'
  | 'remove'
  | 'rm'
  | 'un'
  | 'install'
  | 'i'
  | 'update'
  | 'up'
  | 'audit'
type FlagGroup = 'lock' | 'scope' | 'output'

interface PmFlagRule {
  id: string
  names: string[]
  commands: ReadonlySet<PmCommand>
  group?: FlagGroup
  resolve: (pm: PackageManager) => string
}

const PmCommands = new Set<PmCommand>([
  'add',
  'remove',
  'rm',
  'un',
  'install',
  'i',
  'update',
  'up',
  'audit',
])
const AddInstallUpdateCommands = new Set<PmCommand>([
  'add',
  'install',
  'i',
  'update',
  'up',
])
const InstallUpdateCommands = new Set<PmCommand>(['install', 'update', 'up'])

const PmFlagRules: PmFlagRule[] = [
  {
    id: 'lock-only',
    names: ['--lock-only'],
    commands: InstallUpdateCommands,
    group: 'lock',
    resolve: pm => pm.lockFlags.lockOnly,
  },
  {
    id: 'frozen-lockfile',
    names: ['--frozen-lockfile', '--frozen-lock-file'],
    commands: InstallUpdateCommands,
    group: 'lock',
    resolve: pm => pm.lockFlags.frozenLockFile,
  },
  {
    id: 'ignore-scripts',
    names: ['--ignore-scripts'],
    commands: AddInstallUpdateCommands,
    resolve: pm => pm.ignoreFlags.ignoreScripts,
  },
  {
    id: 'ignore-engines',
    names: ['--ignore-engines'],
    commands: AddInstallUpdateCommands,
    resolve: pm => pm.ignoreFlags.ignoreEngines,
  },
  {
    id: 'ignore-optional',
    names: ['--ignore-optional'],
    commands: AddInstallUpdateCommands,
    resolve: pm => pm.ignoreFlags.ignoreOptional,
  },
  {
    id: 'ignore-workspace-root-check',
    names: ['--ignore-workspace-root-check'],
    commands: AddInstallUpdateCommands,
    resolve: pm => pm.ignoreFlags.ignoreWorkspaceRootCheck,
  },
  {
    id: 'ignore-pnp',
    names: ['--ignore-pnp'],
    commands: AddInstallUpdateCommands,
    resolve: pm => pm.ignoreFlags.ignorePnP,
  },
  {
    id: 'production',
    names: ['--production', '--prod'],
    commands: AddInstallUpdateCommands,
    group: 'scope',
    resolve: pm => pm.scopeFlags.production,
  },
  {
    id: 'dev',
    names: ['--dev'],
    commands: AddInstallUpdateCommands,
    group: 'scope',
    resolve: pm => pm.scopeFlags.dev,
  },
  {
    id: 'peer',
    names: ['--peer'],
    commands: AddInstallUpdateCommands,
    group: 'scope',
    resolve: pm => pm.scopeFlags.peer,
  },
  {
    id: 'optional',
    names: ['--optional'],
    commands: AddInstallUpdateCommands,
    group: 'scope',
    resolve: pm => pm.scopeFlags.optional,
  },
  {
    id: 'verbose',
    names: ['--verbose'],
    commands: PmCommands,
    group: 'output',
    resolve: pm => pm.outputFlags.verbose,
  },
  {
    id: 'silent',
    names: ['--silent'],
    commands: PmCommands,
    group: 'output',
    resolve: pm => pm.outputFlags.silent,
  },
]

const PmFlagRuleByName = new Map<string, PmFlagRule>()
for (const rule of PmFlagRules) {
  for (const name of rule.names) {
    PmFlagRuleByName.set(name, rule)
  }
}

function mapPmFlags(
  command: PmCommand,
  args: string[],
  pm: PackageManager
): string[] {
  const mapped: string[] = []
  const passthrough: string[] = []
  const seenRules = new Set<string>()
  const groups = new Map<FlagGroup, string>()
  let parseFlags = true

  for (const arg of args) {
    if (!parseFlags) {
      passthrough.push(arg)
      continue
    }
    if (arg === '--') {
      parseFlags = false
      passthrough.push(arg)
      continue
    }
    if (!arg.startsWith('-') || arg.includes('=')) {
      passthrough.push(arg)
      continue
    }

    const rule = PmFlagRuleByName.get(arg)
    if (!rule) {
      passthrough.push(arg)
      continue
    }
    if (!rule.commands.has(command)) {
      const supportedCommands = Array.from(rule.commands)
        .map(pmCommand => `opk ${pmCommand}`)
        .join(', ')
      throw new Error(`${arg} can only be used with ${supportedCommands}`)
    }

    if (rule.group) {
      const selectedRule = groups.get(rule.group)
      if (selectedRule && selectedRule !== rule.id) {
        throw new Error(`Use only one ${rule.group} flag at a time`)
      }
      groups.set(rule.group, rule.id)
    }

    if (!seenRules.has(rule.id)) {
      const pmFlag = rule.resolve(pm).trim()
      if (!pmFlag) {
        throw new Error(`${arg} is not supported by ${pm.name}`)
      }
      mapped.push(pmFlag)
      seenRules.add(rule.id)
    }
  }

  return [...mapped, ...passthrough]
}

function hasPositionalArg(args: string[]): boolean {
  let hasSeparator = false
  for (const arg of args) {
    if (hasSeparator) {
      return true
    }
    if (arg === '--') {
      hasSeparator = true
      continue
    }
    if (!arg.startsWith('-')) {
      return true
    }
  }
  return false
}

export async function runCli(args: string[]): Promise<void> {
  const command = args[0] ?? 'generate'
  const hasPackageTs = await exists(resolve(process.cwd(), 'package.ts'))
  const inferenceMode = !hasPackageTs

  if (inferenceMode) {
    console.log(
      `${paint('Opk is running without a package.ts. Create one with opk migrate', C.lavender)}\n`
    )
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'init') {
    await runInit()
    return
  }

  if (command === 'migrate') {
    await runMigrate()
    return
  }

  if (command === 'list') {
    await runList(args[1] ?? 'package.json')
    return
  }

  if (command === 'info') {
    const packageName = args[1]
    if (!packageName) {
      await runInfo('', true)
      return
    }
    await runInfo(packageName)
    return
  }

  if (command === 'sync') {
    if (inferenceMode) {
      throw new Error('sync requires a package.ts. Run opk migrate first')
    }
    await syncAndGenerate(args[1] ?? 'package.ts', args[2] ?? 'package.json')
    return
  }

  if (command === 'generate') {
    if (inferenceMode) {
      throw new Error('generate requires a package.ts. Run opk migrate first')
    }
    const config = await loadConfig(args[1] ?? 'package.ts')
    await writePackageJson(config, { outputPath: args[2] ?? 'package.json' })
    return
  }

  if (command === 'run' || command === 'exec') {
    const pm = inferenceMode
      ? (await detectPmSelection()).manager
      : (await loadConfig('package.ts')).pm
    const pass = args.slice(1)
    if (pass.length === 0) {
      throw new Error(`opk ${command} requires at least one argument`)
    }
    await runPmOnly(command === 'run' ? pm.run : pm.exec, pass)
    return
  }

  if (PmCommands.has(command as PmCommand)) {
    const pmCommand = command as PmCommand
    const pm = inferenceMode
      ? (await detectPmSelection()).manager
      : (await loadConfig('package.ts')).pm
    const commandArgs = args.slice(1)
    if (
      (pmCommand === 'add' || pmCommand === 'remove') &&
      !hasPositionalArg(commandArgs)
    ) {
      throw new Error(`opk ${pmCommand} requires at least one package`)
    }
    const mappedArgs = mapPmFlags(pmCommand, commandArgs, pm)

    const selected =
      pmCommand === 'add'
        ? pm.add
        : pmCommand === 'remove' || pmCommand === 'rm' || pmCommand === 'un'
          ? pm.remove
          : pmCommand === 'install' || pmCommand === 'i'
            ? pm.install
            : pmCommand === 'update' || pmCommand === 'up'
              ? pm.update
              : pm.audit

    if (inferenceMode) {
      await runPmOnly(selected, mappedArgs)
      return
    }

    await runPmCommand(
      selected,
      mappedArgs,
      'package.ts',
      'package.json',
      pmCommand !== 'audit'
    )
    return
  }

  throw new Error(`Unknown command: ${command}`)
}
