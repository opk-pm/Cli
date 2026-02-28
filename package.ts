import { BunPm, definePackage, NodePm } from '@opk/ts-pkg'

export const Logo: string = `
          $$$$$$$$$$$$$$             
       $$$$$$$$$$$$$$$$$$$$          
     $$$$$$$$$$     $$$$$$$$$        
    $$$$$$$$$$$         $$$$$$       
  $$$$$$  $$$$$           $$$$$$     
 $$$$$$   $$$$$            $$$$$$    
$$$$$     $$$$$              $$$$$   
$$$$$     $$$$$$$$         $$$$$$$   
$$$$$     $$$$$$$$$$$$$$$$$$$$$$$$   
$$$$$     $$$$$$$$$$$$$$$$$$$$$$$$   
$$$$$     $$$$$  $$$$$$$$$$  $$$$$   
$$$$$     $$$$$    $$$$$$$   $$$$$   
 $$$$$$   $$$$$      $$$$$$$$$$$$    
  $$$$$$  $$$$$       $$$$$$$$$$     
    $$$$$$$$$$$         $$$$$$       
     $$$$$$$$$$     $$$$$$$$$        
       $$$$$$$$$$$$$$$$$$$$          
          $$$$$$$$$$$$$$             
`

export const CmdName: string = 'opk'

export const WhatsNew: string = `
Opk 0.5 now has useful flags for package management, such as lockfile only installs.
Furthermore, you can now keep other lockfiles up to date using the altPms field in package.ts.

Finally, Opk 0.5 fixes some critical issues:
  ∙ Package.json no longer de-syncs after installs
  ∙ New aliases for common commands added for better compat
`

export default definePackage({
  pm: BunPm,
  altPms: [NodePm],
  name: 'opk-pm',
  description: 'The universal package manager for JS/TS.',
  version: '0.5.0',
  license: 'Apache-2.0',
  repository: 'https://github.com/opk-pm/Cli.git',
  homepage: 'https://opk.a35.dev/',
  keywords: [
    'opk',
    'typescript',
    'package-json',
    'npm',
    'bun',
    'deno',
    'pnpm',
    'yarn',
    'monorepo-tooling',
    'nodejs',
  ],

  type: 'module',
  main: 'dist/cli.js',
  module: 'dist/cli.js',
  bin: {
    opk: './dist/cli.js',
    opx: './dist/opx.js',
  },
  files: ['dist'],
  scriptPresets: ['typescript', 'prettier'],
  scripts: {
    build: 'bun run build.ts',
    dev: 'bun run src/cli.ts help',
  },

  devDependencies: {
    '@types/bun': 'latest',
    typescript: '6.0.0-beta',
  },
  dependencies: {
    '@opk/ts-pkg': '^0.6.0',
  },

  private: false,
})
