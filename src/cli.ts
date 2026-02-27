import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import pkg, { WhatsNew } from '../package'
import { runCli } from './commands/router'
import { exists } from './core/fs'
import { C, paint } from './ui/colors'

const lastInstalledVersionPath = join(
  homedir(),
  '.opk',
  'last-installed-version'
)

async function printWhatsNewOnVersionChange(always?: boolean): Promise<void> {
  const currentVersion = pkg.version ?? '0.0.0'
  const hasStoredVersion = await exists(lastInstalledVersionPath)
  const storedVersion = hasStoredVersion
    ? (await readFile(lastInstalledVersionPath, 'utf8')).trim()
    : ''

  if (storedVersion === currentVersion && !always) {
    return
  }

  await mkdir(dirname(lastInstalledVersionPath), { recursive: true })
  await writeFile(lastInstalledVersionPath, `${currentVersion}\n`, 'utf8')

  console.log(paint('Welcome back to Opk!', C.pink))
  console.log(paint(`What's new with ${pkg.version}:`, C.purple))
  console.log(WhatsNew)
  console.log(paint('------------------------------', C.dim))
  console.log()
}

export async function main(): Promise<void> {
  await printWhatsNewOnVersionChange(process.argv.includes('--whats-new'))
  await runCli(process.argv.slice(2))
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`${paint('opk error:', C.pink)} ${message}`)
  process.exit(1)
})
