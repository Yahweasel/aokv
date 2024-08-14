// SPDX-License-Identifier: ISC
/*
 * Copyright (c) 2024 Yahweasel
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY
 * SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION
 * OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN
 * CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

import * as f from "./format";

/**
 * Serialize this data into binary data as a Uint8Array. data may be an
 * ArrayBuffer view, or anything JSON serializable.
 * @param key  Key to assign to this data.
 * @param data  Data to serialize.
 * @param lastIndexOffset  Offset of the most recent index.
 * @param fileId  ID to add to magic numbers.
 * @param compress  Optional function to compress data.
 */
export async function serialize(
    key: string, data: any, lastIndexOffset: number, fileId: number,
    compress?: (x: Uint8Array) => Promise<Uint8Array>
) {
    let desc: f.Descriptor = {t: f.SerType.JSON}; 
    let post: Uint8Array | null = null;

    // Serialize TypedArrays
    if (data && data.buffer && data.buffer instanceof ArrayBuffer) {
        desc.t = f.SerType.TypedArray;
        if (data instanceof Uint8Array) {
            desc.a = "Uint8Array";
        } else if (data instanceof Uint8ClampedArray) {
            desc.a = "Uint8ClampedArray";
        } else if (data instanceof Int16Array) {
            desc.a = "Int16Array";
        } else if (data instanceof Uint16Array) {
            desc.a = "Uint16Array";
        } else if (data instanceof Int32Array) {
            desc.a = "Int32Array";
        } else if (data instanceof Uint32Array) {
            desc.a = "Uint32Array";
        } else if (data instanceof Float32Array) {
            desc.a = "Float32Array";
        } else if (data instanceof Float64Array) {
            desc.a = "Float64Array";
        } else if (data instanceof DataView) {
            desc.a = "DataView";
        } else {
            throw new Error("Unrecognized TypedArray type");
        }

        post = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    } else if (data instanceof ArrayBuffer) {
        desc.t = f.SerType.ArrayBuffer;
        post = new Uint8Array(data);

    } else {
        desc.d = data;

    }

    const te = new TextEncoder();
    const keyU8 = te.encode(key);
    const descU8 = te.encode(JSON.stringify(desc));

    let body = new Uint8Array(
        4 +
        descU8.length +
        (post ? post.length : 0)
    );
    (new Uint32Array(body.buffer, 0, 1))[0] = descU8.length;
    body.set(descU8, 4);
    if (post)
        body.set(post, 4 + descU8.length);

    if (compress) {
        const c = await compress(body);
        if (
            c.length < body.length /* compression was useful */ &&
            (c.length < 4 || c[4] !== 0x7b) /* looks compressed */
        ) {
            body = c;
        }
    }

    const serialized = new Uint8Array(
        f.KVPHeader.SizeU8 +
        keyU8.length +
        body.length +
        4
    );
    const serU32 = new Uint32Array(
        serialized.buffer, 0, f.KVPHeader.SizeU32
    );
    serU32[f.MagicHeader.Magic0] = f.aokvMagic;
    serU32[f.MagicHeader.Magic1] = f.aokvMagicKVP + fileId;
    serU32[f.MagicHeader.BlockSz] = serialized.length;
    serU32[f.KVPHeader.KeySz] = keyU8.length;
    serialized.set(keyU8, f.KVPHeader.SizeU8);
    serialized.set(
        body, f.KVPHeader.SizeU8 + keyU8.length
    );
    const serDV = new DataView(serialized.buffer);
    serDV.setUint32(
        f.KVPHeader.SizeU8 + keyU8.length + body.length,
        lastIndexOffset + f.KVPHeader.SizeU8 + keyU8.length + body.length,
        true
    );

    return {
        buf: serialized,
        hdr: f.KVPHeader.SizeU8,
        key: keyU8.length,
        body: body.length,
        foot: 4
    };
}

/**
 * Serialize this index.
 * @param index  Index to serialize.
 * @param fileId  ID to add to magic numbers.
 * @param compress  Compression function.
 */
export async function serializeIndex(
    index: any, fileId: number,
    compress?: (x: Uint8Array) => Promise<Uint8Array>
) {
    let indexU8 = new TextEncoder().encode(
        JSON.stringify(index)
    );

    if (compress) {
        const c = await compress(indexU8);
        if (c.length < indexU8.length && c.length && c[0] !== 0x7b)
            indexU8 = c;
    }

    const buf = new Uint8Array(
        f.MagicHeader.SizeU8 +
        indexU8.length +
        4
    );

    const hdrU32 = new Uint32Array(
        buf.buffer, 0, f.MagicHeader.SizeU32
    );
    hdrU32[f.MagicHeader.Magic0] = f.aokvMagic;
    hdrU32[f.MagicHeader.Magic1] = f.aokvMagicIndex + fileId;
    hdrU32[f.MagicHeader.BlockSz] = buf.length;
    buf.set(indexU8, f.MagicHeader.SizeU8);
    const bufDV = new DataView(buf.buffer);
    bufDV.setUint32(
        f.MagicHeader.SizeU8 + indexU8.length,
        f.MagicHeader.SizeU8 + indexU8.length,
        true
    );

    return buf;
}
