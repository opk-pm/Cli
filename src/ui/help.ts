import { C, paint } from './colors'
import pkg, { logo, cmdName } from '../../package'

export function printHelp(): void {
  console.log(
    `
${paint(logo, C.bold + C.purple)}
${paint(cmdName, C.bold + C.pink)} ${paint('- ' + pkg.description, C.lavender)}
${paint('Version: ' + pkg.version, C.dim)}

Usage:
  ${paint(cmdName, C.dim)} init
  ${paint(cmdName, C.dim)} add <pkg...>
  ${paint(cmdName, C.dim)} remove <pkg...>
  ${paint(cmdName, C.dim)} install
  ${paint(cmdName, C.dim)} update [pkg...]
  ${paint(cmdName, C.dim)} audit
  ${paint(cmdName, C.dim)} run <pkg script> [args...]
  ${paint(cmdName, C.dim)} exec <cmd> [args...]
  ${paint(cmdName, C.dim)} list
  ${paint(cmdName, C.dim)} info <pkg>
  ${paint(cmdName, C.dim)} sync [configPath] [packageJsonPath]
  ${paint(cmdName, C.dim)} generate [configPath] [packageJsonPath]
  ${paint(cmdName, C.dim)} help

Notes:
  ${paint('∙', C.dim)} PM-backed commands use the package manager selected in package.ts (pm field)
  ${paint('∙', C.dim)} Opk automatically keeps your package.ts up to date
`
  )
}
