import { BunPm, definePackage } from '@opk/ts-pkg'

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
In Opk 0.4.1, you can now run the opk info command on your current project directory!
This allows for a quick overview of your project's metadata and deps.
This update also includes release notes, like these, being printed on first run of a new version.
`

export default definePackage({
  pm: BunPm,
  name: 'opk-pm',
  description: 'The universal package manager for JS/TS.',
  version: '0.4.1',
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
  },
  peerDependencies: {
    typescript: '^5',
  },
  dependencies: {
    '@opk/ts-pkg': '^0.5.0',
  },

  private: false,
})
