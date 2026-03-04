import { BunPm, definePackage, NodePm } from '@opk/ts-pkg'

export default definePackage({
  pm: BunPm,
  altPms: [ NodePm ],
  name: '@opk/gui',
  description: 'The GUI for Opk, the universal package manager for JS/TS.',
  version: '0.1.0',
  type: 'module',
  scripts: {
    dev: 'vite --host --port 1562', // default opk port + 1
    preview: 'vite preview --port 1563', // default opk port + 2
    build: 'vue-tsc --noEmit && vite build',
    check: 'vue-tsc --noEmit',
  },
  dependencies: {
    '@iconify/vue': '^4.1.2',
    echarts: '^6.0.0',
    vue: '^3.5.13',
  },
  devDependencies: {
    '@types/node': '^24.0.0',
    '@vitejs/plugin-vue': '^5.2.0',
    sass: '^1.83.0',
    typescript: '^5.6.3',
    vite: '^6.0.11',
    'vue-tsc': '^2.1.10',
  },
})
