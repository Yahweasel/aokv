import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const plugins = [typescript()];

export default [{
    input: "src/main.ts",
    output: [
        {
            file: "dist/aokv.js",
            format: "umd",
            name: "AOKV"
        }, {
            file: "dist/aokv.min.js",
            format: "umd",
            name: "AOKV",
            plugins: [terser()]
        }
    ],
    plugins
}, {
    input: "src/aokvw.ts",
    output: [
        {
            file: "dist/aokvw.js",
            format: "umd",
            name: "AOKVW"
        }, {
            file: "dist/aokvw.min.js",
            format: "umd",
            name: "AOKVW",
            plugins: [terser()]
        }
    ],
    plugins
}, {
    input: "src/aokvr.ts",
    output: [
        {
            file: "dist/aokvr.js",
            format: "umd",
            name: "AOKVR"
        }, {
            file: "dist/aokvr.min.js",
            format: "umd",
            name: "AOKVR",
            plugins: [terser()]
        }
    ],
    plugins
}];
