import { syncAndGenerate } from './config'

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
  packageJsonPath: string = 'package.json'
): Promise<void> {
  const parts = splitBaseCommand(base)
  if (parts.length === 0) {
    throw new Error('Invalid package manager command')
  }

  const [cmd, ...baseArgs] = parts
  await runCommand(cmd!, [...baseArgs, ...args])
  await syncAndGenerate(configPath, packageJsonPath)
}

export async function runPmOnly(base: string, args: string[]): Promise<void> {
  const parts = splitBaseCommand(base)
  if (parts.length === 0) {
    throw new Error('Invalid package manager command')
  }
  const [cmd, ...baseArgs] = parts
  await runCommand(cmd!, [...baseArgs, ...args])
}
