import { cp, mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'

import Bun from 'bun'

const projectRoot = process.cwd()
const distPath = resolve(projectRoot, 'dist')
const guiPath = resolve(projectRoot, 'gui')
const guiDistPath = resolve(guiPath, 'dist')
const bundledGuiPath = resolve(distPath, 'gui')

await Bun.build({
  entrypoints: [ './src/cli.ts', './src/opx.ts' ],
  outdir: distPath,
  format: 'esm',
  target: 'node',
  splitting: false,
  sourcemap: 'none',
  minify: true,
  banner: '#!/usr/bin/env bun',
})

await runCommand([ 'bun', 'run', 'build' ], guiPath)
await rm(bundledGuiPath, { recursive: true, force: true })
await mkdir(distPath, { recursive: true })
await cp(guiDistPath, bundledGuiPath, { recursive: true })

console.log('✨ Build complete (CLI + GUI)')

async function runCommand(command: string[], cwd: string): Promise<void> {
  const proc = Bun.spawn(command, {
    cwd,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const code = await proc.exited
  if (code !== 0) {
    process.exit(code)
  }
}
