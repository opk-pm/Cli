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
Opk 0.6 introduces the all-new Opk Gui!
The Opk gui allows you to manage your projects, see dependencies visually, and find packages.
This feature is experimental! Try with the opk gui command.

Also in Opk 0.6, you can quickly see outdated packages with opk outdated!
`

export default definePackage({
  pm: BunPm,
  altPms: [ NodePm ],
  name: 'opk-pm',
  description: 'The universal package manager for JS/TS.',
  version: '0.7.0-beta1',
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
  files: [ 'dist' ],
  scriptPresets: [ 'typescript' ],
  scripts: {
    // run
    build: 'bun run build.ts',
    dev: 'bun run src/cli.ts help',

    // code style
    prettier:
      'prettier --write --experimental-cli --ignore-path .prettierignore .',
    lint: 'eslint . --fix',
    format: 'opk run prettier && opk run lint',
  },

  devDependencies: {
    '@types/bun': 'latest',
    '@typescript-eslint/parser': '^8.56.1',
    eslint: '9',
    'eslint-plugin-import': '^2.32.0',
    'eslint-plugin-import-typescript': '^0.0.4',
    'eslint-plugin-simple-import-sort': '^12.1.1',
    jiti: '^2.6.1',
    prettier: '^3.8.1',
    typescript: '^5.9.3',
    'vue-eslint-parser': '^10.4.0',
  },
  dependencies: {
    '@opk/ts-pkg': '^0.6.1',
  },

  engines: {
    node: '>=22',
    bun: '>=1.3.5',
  },
  private: false,
})
