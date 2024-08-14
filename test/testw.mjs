import * as fs from "fs/promises";
import * as zlib from "node:zlib";
import * as aokvw from "../dist/aokvw.js";

const w = new aokvw.AOKVW(x => new Promise((res, rej) => {
    zlib.deflateRaw(x, (e, r) => {
        if (e) rej(e);
        else res(r);
    });
}));
const wp = fs.writeFile("test.aokv", w.stream);

await w.setItem("amazing", [3, 1, 4, 1]);
await w.setItem("hello", "world");
await w.setItem("bleh", new Uint8Array([1, 2, 3, 4, 5]));
await w.setItem("hello", "whoops");
await w.setItem("an object here", {"this": {"is": {"an": "object"}}});
await w.setItem("hello", "Hello, world!");
await w.removeItem("amazing");
await w.end();
await wp;
