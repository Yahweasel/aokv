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

export interface GenHeaderInfo {
    size: number;
}

export interface KVPHeaderInfo extends GenHeaderInfo {
    type: "kvp";
    key: number;
    body: number;
}

export interface IndexHeaderInfo extends GenHeaderInfo {
    type: "index";
    index: number;
}

export interface UnknownHeaderInfo extends GenHeaderInfo {
    type: "unknown";
}

export type HeaderInfo =
    KVPHeaderInfo | IndexHeaderInfo | UnknownHeaderInfo | null;

/**
 * Deserialize an AOKV header, to get information on how much to read for the
 * body.
 * @param header  Header data
 * @param fileId  ID of the file, to offset magic numbers
 * @param opts  Other options
 */
export function deserializeHeader(data: Uint8Array, fileId: number, opts: {
    /**
     * Demand correct header info.
     */
    checkHeader?: boolean
} = {}): HeaderInfo {
    const dU32 = new Uint32Array(
        data.buffer, data.byteOffset, ~~(data.byteLength / 4)
    );

    if (dU32.length < f.MagicHeader.SizeU32) {
        if (opts.checkHeader)
            throw new Error("AOKV header mismatch");
        return null;
    }

    if (opts.checkHeader && dU32[f.MagicHeader.Magic0] !== f.aokvMagic)
        throw new Error("AOKV header mismatch");

    const magic1 = ~~dU32[f.MagicHeader.Magic1];

    switch (magic1) {
        case (~~(f.aokvMagicKVP + fileId)): // KVP
        {
            if (dU32.length < f.KVPHeader.SizeU32) {
                if (opts.checkHeader)
                    throw new Error("AOKV KVP header mismatch");
                return null;
            }

            const blockSz = dU32[f.MagicHeader.BlockSz];
            const keySz = dU32[f.KVPHeader.KeySz];
            return {
                type: "kvp",
                size: blockSz,
                key: keySz,
                body: blockSz - f.KVPHeader.SizeU8 - keySz - 4
            };
        }

        case (~~(f.aokvMagicIndex + fileId)):
        {
            const blockSz = dU32[f.MagicHeader.BlockSz];
            return {
                type: "index",
                size: blockSz,
                index: blockSz - f.MagicHeader.SizeU8 - 4
            };
        }

        default:
            if (opts.checkHeader &&
                (magic1 < ~~(f.aokvMagicKVP + fileId) ||
                 magic1 >= ~~(f.aokvMagicMax + fileId))) {
                throw new Error("AOKV invalid header");
            }
            return {
                type: "unknown",
                size: dU32[f.MagicHeader.BlockSz]
            };
    }
}

/**
 * Deserialize this KVP body, as serialized by `serialize`, into a value.
 * @param body  Body to deserialize.
 * @param decompress  Function to decompress, if applicable.
 */
export async function deserializeKVP(
    body: Uint8Array,
    decompress?: (x: Uint8Array) => Promise<Uint8Array>
) {
    if (decompress) {
        // Check if it actually is compressed
        if (body.length < 4 || body[4] !== 0x7b)
            body = await decompress(body);
    }

    const descSz = (new Uint32Array(body.buffer, body.byteOffset, 1))[0];
    const desc: f.Descriptor = JSON.parse(new TextDecoder().decode(
        body.subarray(4, 4 + descSz)
    ));

    let post: Uint8Array | undefined;
    if (body.length > 4 + descSz)
        post = body.subarray(4 + descSz);

    let ret: any;
    switch (desc.t) {
        case f.SerType.TypedArray:
        {
            let ta: any;
            switch (desc.a) {
                case "Uint8Array": ta = Uint8Array; break;
                case "Uint8ClampedArray": ta = Uint8ClampedArray; break;
                case "Int16Array": ta = Int16Array; break;
                case "Uint16Array": ta = Uint16Array; break;
                case "Int32Array": ta = Int32Array; break;
                case "Uint32Array": ta = Uint32Array; break;
                case "Float32Array": ta = Float32Array; break;
                case "Float64Array": ta = Float64Array; break;
                case "DataView": ta = DataView; break;
                default:
                    throw new Error(`Unrecognized TypedArray type ${desc.a}`);
            }

            ret = new ta(post);
            break;
        }

        case f.SerType.ArrayBuffer:
            ret = post!.buffer;
            break;

        case f.SerType.JSON:
            ret = desc.d;
            break;

        default:
            throw new Error(`Unrecognized serialized type ${desc.t}`);
    }

    return ret;
}
