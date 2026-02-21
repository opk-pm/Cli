import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { writePackageJson } from '@opk/ts-pkg'
import { detectPmSelection, loadConfig, syncAndGenerate } from '../core/config'
import { exists } from '../core/fs'
import type { ModuleType } from '../types'
import { C, paint } from '../ui/colors'

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "\\'")
}

async function promptInit(): Promise<{
  name: string
  description: string
  license: string
  moduleType: ModuleType
}> {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    const name = (await rl.question('Package name: ')).trim() || 'my-project'
    const description = (await rl.question('Description: ')).trim()
    const license = (await rl.question('License (MIT): ')).trim() || 'MIT'
    const moduleTypeRaw =
      (await rl.question('Module type (module/commonjs) [module]: ')).trim() ||
      'module'

    const moduleType: ModuleType =
      moduleTypeRaw.toLowerCase() === 'commonjs' ? 'commonjs' : 'module'

    return { name, description, license, moduleType }
  } finally {
    rl.close()
  }
}

export async function runInit(): Promise<void> {
  const packageTsPath = resolve(process.cwd(), 'package.ts')
  if (await exists(packageTsPath)) {
    throw new Error('package.ts already exists')
  }

  const answers = await promptInit()
  const pmSelection = await detectPmSelection()
  const content = `import { definePackage, ${pmSelection.importName} } from '@opk/ts-pkg'

export default definePackage({
  pm: ${pmSelection.importName},
  name: '${escapeSingleQuotes(answers.name)}',
  description: '${escapeSingleQuotes(answers.description)}',
  license: '${escapeSingleQuotes(answers.license)}',
  type: '${answers.moduleType}',
  dependencies: {
    '@opk/ts-pkg': '^0.5.0',
  },
  private: false,
})
`

  await writeFile(packageTsPath, content)
  console.log(
    `\n${paint('Initialized', C.pink)} package.ts with ${paint(pmSelection.manager.name, C.purple)}`
  )

  const config = await loadConfig('package.ts')
  await writePackageJson(config, {
    outputPath: resolve(process.cwd(), 'package.json'),
  })
  await syncAndGenerate('package.ts', 'package.json')

  console.log(`\nRun ${paint('bun i', C.purple)} to install dependencies`)
  console.log(`Or, edit your ${paint('package.ts', C.purple)} to use a different PM`)
}
