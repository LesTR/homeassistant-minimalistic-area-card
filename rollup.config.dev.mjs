import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';
import ignore from 'rollup-plugin-ignore';

export default {
  input: ['src/minimalistic-area-card.ts'],
  strictDeprecations: true,
  output: {
    format: 'es',
    file: 'dist/better-minimalistic-area-card.js',
    sourcemap: true,
  },
  plugins: [
    resolve(),
    commonjs(),
    typescript({ sourceMap: true, inlineSources: true }),
    json(),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
    }),
    terser(),
    serve({
      contentBase: './dist',
      host: '0.0.0.0',
      port: 6001,
      allowCrossOrigin: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }),
    ignore(['@material/web'], { commonjsBugFix: true }),
  ],
};
