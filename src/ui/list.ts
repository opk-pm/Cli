import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { PackageJsonSummary } from '../types'
import { C, paint } from './colors'

function fitLabel(text: string, width: number): string {
  if (text.length <= width) return text
  if (width <= 1) return text.slice(0, width)
  return `${text.slice(0, width - 1)}…`
}

function buildHeader(name: string, version: string): string[] {
  const innerWidth = 36
  const top = paint(`╭${'─'.repeat(innerWidth)}╮`, C.purple)
  const bottom = paint(`╰${'─'.repeat(innerWidth)}╯`, C.purple)

  const rawTitle = version ? `${name} ${version}` : name
  const title = fitLabel(rawTitle, innerWidth - 2)
  const padded = ` ${title}`.padEnd(innerWidth, ' ')

  const content =
    paint('│', C.purple) + paint(padded, C.bold + C.pink) + paint('│', C.purple)

  return [top, content, bottom]
}

function collectDeps(
  name: string,
  deps: Record<string, string> | undefined
): string[] {
  if (!deps || Object.keys(deps).length === 0) return []
  return [
    paint(`${name}:`, C.purple),
    ...Object.entries(deps)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([pkg, ver]) => `  ${paint('•', C.pink)} ${pkg} ${paint(ver, C.dim)}`
      ),
  ]
}

export async function runList(
  packageJsonPath: string = 'package.json'
): Promise<void> {
  const absolute = resolve(process.cwd(), packageJsonPath)
  const content = await readFile(absolute, 'utf-8')
  const pkg = JSON.parse(content) as PackageJsonSummary

  const lines = [
    ...buildHeader(pkg.name ?? 'unnamed-project', pkg.version ?? ''),
    '',
    ...collectDeps('dependencies', pkg.dependencies),
    ...collectDeps('devDependencies', pkg.devDependencies),
    ...collectDeps('peerDependencies', pkg.peerDependencies),
  ]

  if (lines[lines.length - 1] === '') {
    lines.pop()
  }
  if (lines.length <= 4) {
    lines.push(paint('No dependencies found', C.dim))
  }

  console.log(lines.join('\n'))
}
