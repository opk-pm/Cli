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
  module: 'src/cli.ts',
  bin: {
    opk: './index.ts',
  },
  scriptPresets: ['typescript', 'prettier'],
  scripts: {
    dev: 'bun run index.ts help',
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
