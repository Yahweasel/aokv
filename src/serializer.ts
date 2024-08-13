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

import {aokvHeader, SerType, Descriptor, Header} from "./format";

/**
 * Serialize this data into binary data as a Uint8Array. data may be an
 * ArrayBuffer view, or anything JSON serializable.
 * @param key  Key to assign to this data.
 * @param data  Data to serialize.
 * @param compress  Optional function to compress data.
 */
export async function serialize(
    key: string, data: any, compress?: (x: Uint8Array) => Promise<Uint8Array>
) {
    let desc: Descriptor = {t: SerType.JSON}; 
    let post: Uint8Array | null = null;

    // Serialize TypedArrays
    if (data && data.buffer && data.buffer instanceof ArrayBuffer) {
        desc.t = SerType.TypedArray;
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
        desc.t = SerType.ArrayBuffer;
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
        Header.SizeU8 +
        keyU8.length +
        body.length
    );
    const serU32 = new Uint32Array(serialized.buffer, 0, Header.SizeU32);
    serU32[Header.Magic0] = aokvHeader[0];
    serU32[Header.Magic1] = aokvHeader[1];
    serU32[Header.KeySz] = keyU8.length;
    serU32[Header.BodySz] = body.length;
    serialized.set(keyU8, Header.SizeU8);
    serialized.set(body, Header.SizeU8 + keyU8.length);

    return serialized;
}
