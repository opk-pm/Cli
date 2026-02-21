await Bun.build({
  entrypoints: ['./src/cli.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',
  splitting: false,
  sourcemap: 'none',
  minify: true,
  banner: '#!/usr/bin/env bun',
})

console.log('✨ Build complete')
