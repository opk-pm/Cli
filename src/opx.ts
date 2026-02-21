import { runCli } from './commands/router'
import { C, paint } from './ui/colors'

export async function main(): Promise<void> {
  await runCli(['exec', ...process.argv.slice(2)])
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`${paint('opx error:', C.pink)} ${message}`)
  process.exit(1)
})
