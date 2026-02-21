import { C, paint } from './colors'
import pkg, { logo } from '../../package'

export function printHelp(): void {
  console.log(
    `
${paint(logo, C.bold + C.purple)}
${paint(pkg.name, C.bold + C.pink)} ${paint('- ' + pkg.description, C.lavender)}
${paint('Version: ' + pkg.version, C.dim)}

Usage:
  ${paint(pkg.name, C.dim)} init
  ${paint(pkg.name, C.dim)} add <pkg...>
  ${paint(pkg.name, C.dim)} remove <pkg...>
  ${paint(pkg.name, C.dim)} install
  ${paint(pkg.name, C.dim)} update [pkg...]
  ${paint(pkg.name, C.dim)} audit
  ${paint(pkg.name, C.dim)} run <pkg script> [args...]
  ${paint(pkg.name, C.dim)} exec <cmd> [args...]
  ${paint(pkg.name, C.dim)} list
  ${paint(pkg.name, C.dim)} sync [configPath] [packageJsonPath]
  ${paint(pkg.name, C.dim)} generate [configPath] [packageJsonPath]
  ${paint(pkg.name, C.dim)} help

Notes:
  ${paint('∙', C.dim)} PM-backed commands use the package manager selected in package.ts (pm field)
  ${paint('∙', C.dim)} Opk automatically keeps your package.ts up to date
`
  )
}
