import { loadConfig, syncAndGenerate } from './config'

function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`
}

function splitBaseCommand(base: string): string[] {
  return base.trim().split(/\s+/).filter(Boolean)
}

export async function runCommand(
  command: string,
  args: string[] = []
): Promise<void> {
  const full = [command, ...args.map(shellEscape)].join(' ')
  const proc = Bun.spawn(['sh', '-lc', full], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  if (code !== 0) {
    process.exit(code)
  }
}

export async function runPmCommand(
  base: string,
  args: string[],
  configPath: string = 'package.ts',
  packageJsonPath: string = 'package.json',
  syncAltPms: boolean = false
): Promise<void> {
  const parts = splitBaseCommand(base)
  if (parts.length === 0) {
    throw new Error('Invalid package manager command')
  }

  const [cmd, ...baseArgs] = parts
  await runCommand(cmd!, [...baseArgs, ...args])
  await syncAndGenerate(configPath, packageJsonPath)
  if (syncAltPms) {
    await syncAltPmLockFiles(configPath)
  }
}

export async function runPmOnly(base: string, args: string[]): Promise<void> {
  const parts = splitBaseCommand(base)
  if (parts.length === 0) {
    throw new Error('Invalid package manager command')
  }
  const [cmd, ...baseArgs] = parts
  await runCommand(cmd!, [...baseArgs, ...args])
}

async function syncAltPmLockFiles(configPath: string): Promise<void> {
  const config = await loadConfig(configPath)
  const altPms = config.altPms ?? []

  for (const altPm of altPms) {
    const lockOnlyArgs = splitBaseCommand(altPm.lockFlags.lockOnly)
    if (lockOnlyArgs.length === 0) {
      throw new Error(`altPms entry ${altPm.name} is missing a lock-only flag`)
    }
    await runPmOnly(altPm.install, lockOnlyArgs)
  }
}
