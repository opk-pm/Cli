import { C, paint } from './colors'
import pkg, { Logo, CmdName } from '../../package'

// Formatted Elements
const Bullet: string = paint('∙', C.dim)
const Command: string = paint(CmdName, C.dim)

export function printHelp(): void {
  console.log(
    `
${paint(Logo, C.bold + C.purple)}
${paint(CmdName, C.bold + C.pink)} ${paint('- ' + pkg.description, C.lavender)}
${paint('Version: ' + pkg.version, C.dim)}

${paint('Usage:', C.bold + C.purple)}
 Package Management:
  ${Command} add <pkg...>
  ${Command} remove <pkg...>
  ${Command} install
  ${Command} update [pkg...]
  ${Command} audit
  
 Execution:
  ${Command} run <pkg script> [args...]
  ${Command} exec <cmd> [args...]
  ${paint('opx', C.dim)} <cmd> [args...]
  
 Project Management:
  ${Command} init
  ${Command} migrate
  ${Command} sync [configPath] [packageJsonPath]
  ${Command} generate [configPath] [packageJsonPath]
  
 Info:
  ${Command} help
  ${Command} list
  ${Command} info <pkg>

 ${paint('Shared PM Flags:', C.bold + C.purple)}
  ${Bullet} ${paint('--lock-only', C.dim)}, ${paint('--frozen-lockfile', C.dim)} (install, update)
  ${Bullet} ${paint('--ignore-scripts', C.dim)}, ${paint('--ignore-engines', C.dim)}, ${paint('--ignore-optional', C.dim)} (add, install, update)
  ${Bullet} ${paint('--ignore-workspace-root-check', C.dim)}, ${paint('--ignore-pnp', C.dim)} (add, install, update)
  ${Bullet} ${paint('--production', C.dim)} / ${paint('--prod', C.dim)}, ${paint('--dev', C.dim)}, ${paint('--peer', C.dim)}, ${paint('--optional', C.dim)} (add, install, update)
  ${Bullet} ${paint('--verbose', C.dim)}, ${paint('--silent', C.dim)} (add, remove, install, update, audit)

${paint('Notes:', C.bold + C.purple)}
  ${Bullet} PM-backed commands use the package manager selected in package.ts (pm field)
  ${Bullet} If there's no package.ts, PM-backed commands will try to detect the PM based on lockfiles
  ${Bullet} Opk automatically keeps your package.ts up to date
`
  )
}
