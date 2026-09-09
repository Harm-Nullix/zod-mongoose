import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import {dts} from 'rollup-plugin-dts';

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
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
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
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
      }),
    ],
    external,
  },

  // TYPES GENERATION
  // Generates types for both backend (index.d.ts) and frontend (index.frontend.d.ts)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
    external,
  },
  {
    input: 'src/index.frontend.ts',
    output: {
      file: 'dist/index.frontend.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
    external,
  },
];
