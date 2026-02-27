import { resolve } from 'node:path'
import { writePackageJson } from '@opk/ts-pkg'
import { detectPmSelection, loadConfig, syncAndGenerate } from '../core/config'
import { exists } from '../core/fs'
import { runPmCommand, runPmOnly } from '../core/shell'
import { runInit } from './init'
import { runInfo } from './info'
import { runMigrate } from './migrate'
import { runList } from '../ui/list'
import { C, paint } from '../ui/colors'
import { printHelp } from '../ui/help'

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

  const pmCommands = new Set(['add', 'remove', 'install', 'update', 'audit'])
  if (pmCommands.has(command)) {
    const pm = inferenceMode
      ? (await detectPmSelection()).manager
      : (await loadConfig('package.ts')).pm
    const packages = args.slice(1)
    if ((command === 'add' || command === 'remove') && packages.length === 0) {
      throw new Error(`opk ${command} requires at least one package`)
    }

    const selected =
      command === 'add'
        ? pm.add
        : command === 'remove'
          ? pm.remove
          : command === 'install'
            ? pm.install
            : command === 'update'
              ? pm.update
              : pm.audit

    if (inferenceMode) {
      await runPmOnly(selected, packages)
      return
    }

    await runPmCommand(selected, packages)
    return
  }

  throw new Error(`Unknown command: ${command}`)
}
