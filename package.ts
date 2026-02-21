import { BunPm, definePackage } from '@opk/ts-pkg'

export const logo: string = `
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

export default definePackage({
  pm: BunPm,
  name: 'opk',
  description: 'The universal package manager for JS/TS.',
  version: '0.1.0',
  license: 'Apache-2.0',
  keywords: [
    'opk',
    'typescript',
    'package-json',
    'npm',
    'bun',
    'monorepo-tooling',
    'nodejs',
  ],

  type: 'module',
  main: 'dist/cli.js',
  module: 'dist/cli.js',
  bin: {
    opk: './dist/cli.js',
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
