import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  detectPmSelection,
  runPrettierWritePackageTs,
  shouldFormatPackageTs,
} from '../core/config'
import { exists } from '../core/fs'
import { C, paint } from '../ui/colors'

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

function renderLiteral(value: JsonValue, indent: number = 2): string {
  return JSON.stringify(value, null, indent)
}

export async function runMigrate(): Promise<void> {
  const packageTsPath = resolve(process.cwd(), 'package.ts')
  const packageJsonPath = resolve(process.cwd(), 'package.json')

  if (await exists(packageTsPath)) {
    throw new Error('package.ts already exists')
  }

  if (!(await exists(packageJsonPath))) {
    throw new Error('package.json not found')
  }

  const raw = await readFile(packageJsonPath, 'utf-8')
  const pkg = JSON.parse(raw) as Record<string, JsonValue>
  const { importName, manager } = await detectPmSelection()

  // Remove fields that are not useful inside package.ts config.
  delete pkg.packageManager

  const body = renderLiteral(pkg)
  const inner = body.slice(1, -1).trim()
  const packageBody = inner.length > 0 ? `,\n${inner}` : ''

  const content = `import { definePackage, ${importName} } from '@opk/ts-pkg'

export default definePackage({
  pm: ${importName}${packageBody}
})
`

  await writeFile(packageTsPath, content)

  const scripts =
    typeof pkg.scripts === 'object' &&
    pkg.scripts &&
    !Array.isArray(pkg.scripts)
      ? (pkg.scripts as Record<string, string>)
      : undefined
  if (await shouldFormatPackageTs(scripts)) {
    await runPrettierWritePackageTs()
  }

  console.log(
    `${paint('Migrated package.json to package.ts using', C.pink)} ${paint(manager.name, C.purple)}`
  )
}
