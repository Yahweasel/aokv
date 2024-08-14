import * as fs from "fs/promises";
import * as zlib from "node:zlib";
import * as aokvr from "../dist/aokvr.js";

const fh = await fs.open("test.aokv");
const fhs = await fh.stat();
const r = new aokvr.AOKVR(async (count, offset) => {
    const ret = new Uint8Array(count);
    const rd = await fh.read(ret, 0, count, offset);
    if (rd.bytesRead === 0)
        return null;
    else
        return ret.subarray(0, rd.bytesRead);
}, fhs.size, x => new Promise((res, rej) => {
    zlib.inflateRaw(x, (e, r) => {
        if (e) rej(e);
        else res(r);
    });
}));
await r.index({
    checkHeaders: true
});

for (const k of r.keys())
    console.log(k, "=", await r.getItem(k));
