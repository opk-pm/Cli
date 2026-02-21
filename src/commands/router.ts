import { writePackageJson } from '@opk/ts-pkg'
import { loadConfig, syncAndGenerate } from '../core/config'
import { runPmCommand, runPmOnly } from '../core/shell'
import { runInit } from './init'
import { runList } from '../ui/list'
import { printHelp } from '../ui/help'

export async function runCli(args: string[]): Promise<void> {
  const command = args[0] ?? 'generate'

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp()
    return
  }

  if (command === 'init') {
    await runInit()
    return
  }

  if (command === 'list') {
    await runList(args[1] ?? 'package.json')
    return
  }

  if (command === 'sync') {
    await syncAndGenerate(args[1] ?? 'package.ts', args[2] ?? 'package.json')
    return
  }

  if (command === 'generate') {
    const config = await loadConfig(args[1] ?? 'package.ts')
    await writePackageJson(config, { outputPath: args[2] ?? 'package.json' })
    return
  }

  if (command === 'run' || command === 'exec') {
    const config = await loadConfig('package.ts')
    const pass = args.slice(1)
    if (pass.length === 0) {
      throw new Error(`opk ${command} requires at least one argument`)
    }
    await runPmOnly(command === 'run' ? config.pm.run : config.pm.exec, pass)
    return
  }

  const pmCommands = new Set(['add', 'remove', 'install', 'update', 'audit'])
  if (pmCommands.has(command)) {
    const config = await loadConfig('package.ts')
    const packages = args.slice(1)
    if ((command === 'add' || command === 'remove') && packages.length === 0) {
      throw new Error(`opk ${command} requires at least one package`)
    }

    const selected =
      command === 'add'
        ? config.pm.add
        : command === 'remove'
          ? config.pm.remove
          : command === 'install'
            ? config.pm.install
            : command === 'update'
              ? config.pm.update
              : config.pm.audit

    await runPmCommand(selected, packages)
    return
  }

  throw new Error(`Unknown command: ${command}`)
}
