import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import nodeResolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import json from '@rollup/plugin-json';
import ignore from 'rollup-plugin-ignore';

const dev = process.env.ROLLUP_WATCH;

const serveopts = {
  contentBase: ['./dist'],
  host: '0.0.0.0',
  port: 6000,
  allowCrossOrigin: true,
  headers: {
    'Access-Control-Allow-Origin': '*',
  },
};

const plugins = [
  nodeResolve({}),
  commonjs(),
  typescript(),
  json(),
  babel({
    babelHelpers: 'bundled',
    exclude: 'node_modules/**',
  }),
  dev && serve(serveopts),
  !dev && terser(),
  ignore(['@material/web'], { commonjsBugFix: true }),
];

export default [
  {
    input: 'src/minimalistic-area-card.ts',
    strictDeprecations: true,
    output: {
      format: 'es',
      file: 'dist/better-minimalistic-area-card.js',
    },
    plugins: [...plugins],
  },
];
