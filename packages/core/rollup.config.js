import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import esbuild from 'rollup-plugin-esbuild';

// Add mongoose to frontend externals just in case, but the src/index.frontend.ts
// shouldn't even import it to prevent bundling issues.
const external = ['mongoose', 'zod', 'zod/v4', 'lodash', 'node:module'];

export default [
  // BACKEND / NODE TARGET (ESM & CJS)
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
    plugins: [
      resolve(),
      commonjs(),
      esbuild({
        target: 'esnext',
      }),
    ],
    external,
  },

  // FRONTEND / BROWSER TARGET (Pure ESM for Nuxt/Vite)
  {
    input: 'src/index.frontend.ts',
    output: [
      {
        file: 'dist/index.frontend.js',
        format: 'esm',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(),
      commonjs(),
      esbuild({
        target: 'esnext',
      }),
    ],
    external,
  },
];
