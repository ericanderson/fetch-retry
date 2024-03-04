import commonjs from "@rollup/plugin-commonjs";
import { babel } from "@rollup/plugin-babel";
// import pkg from './package.json';

export default [
  {
    input: "index.mjs",
    output: {
      file: "dist/cjs/index.js",
      format: "cjs",
    },
    plugins: [
      babel({
        babelHelpers: "bundled",
        presets: [["@babel/preset-env", { targets: "> 0.25%, not dead" }]],
      }),
    ],
    // plugins: [commonjs()],
  },
  {
    input: "index.mjs",
    output: {
      file: "dist/mjs/index.mjs",
      format: "module",
    },
    plugins: [babel({ babelHelpers: "bundled" })],
    // plugins: [commonjs()],
  },
];
