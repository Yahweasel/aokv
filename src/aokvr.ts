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
import * as ser from "./deserializer";

interface BodyLoc {
    size: number;
    offset: number;
}

type preadT = (count: number, offset: number) => Promise<Uint8Array | null>;

/**
 * An append-only key-value store reader. Must be provided with a pread callback
 * that reads a specified part of a file and returns a (possibly short)
 * Uint8Array, or null if past EOF. The pread should not throw.
 */
export class AOKVR {
    constructor(opts: {
        /**
         * Total size of the file, in bytes, if known.
         */
        size?: number,

        /**
         * Function for reading from the input.
         */
        pread: preadT,

        /**
         * Optional identifier to distinguish your application's AOKV files from
         * other AOKV files. Must match the write ID.
         */
        fileId?: number,

        /**
         * Optional function to decompress. Must match the write compression.
         */
        decompress?: (x: Uint8Array) => Promise<Uint8Array>
    }) {
        this._fileSize = opts.size || 0;
        this._pread = opts.pread;
        this._fileId = opts.fileId || 0;
        this._decompress = opts.decompress;
        this._index = Object.create(null);
    }

    /**
     * Index this file. This MUST be called before using getItem.
     */
    async index(opts: {
        noCheckFirstHeader?: boolean,
        checkHeaders?: boolean
    } = {}) {
        const td = new TextDecoder();

        if (!opts.noCheckFirstHeader) {
            // Check that this is an AOKV file
            const hdr = await this._pread(f.MagicHeader.SizeU8, 0);
            if (!hdr || hdr.length < f.MagicHeader.SizeU8)
                throw new Error("Invalid AOKV file");
            const hdrU32 = new Uint32Array(
                hdr.buffer, hdr.byteOffset, f.MagicHeader.SizeU32
            );
            if (hdrU32[0] !== f.aokvMagic ||
                ~~hdrU32[1] !== ~~(f.aokvMagicKVP + this._fileId))
                throw new Error("Invalid AOKV file");
        }

        // Start from the back, looking for an index or indices
        let offset = this._fileSize;
        do {
            offset -= 4;

            const lastIndexU8 = await this._pread(4, offset);
            if (!lastIndexU8 || lastIndexU8.length < 4) {
                offset = 0;
                break;
            }
            const lastIndexU32 = new Uint32Array(
                lastIndexU8.buffer, lastIndexU8.byteOffset, 1
            );
            offset -= lastIndexU32[0];
            if (offset < 0) {
                offset = 0;
                break;
            }

            // Check that this is an index
            const hdr = await this._pread(f.MagicHeader.SizeU8, offset);
            if (!hdr || hdr.length < f.MagicHeader.SizeU8) {
                offset = 0;
                break;
            }
            const hdrU32 = new Uint32Array(
                hdr.buffer, hdr.byteOffset, f.MagicHeader.SizeU32
            );
            if (hdrU32[0] !== f.aokvMagic ||
                ~~hdrU32[1] !== ~~(f.aokvMagicIndex + this._fileId)) {
                offset = 0;
                break;
            }
            offset += f.MagicHeader.SizeU8;

            // Index it
            const indexSz = hdrU32[f.MagicHeader.BlockSz] - f.MagicHeader.SizeU8;
            let indexU8 = await this._pread(indexSz, offset);
            if (!indexU8 || indexU8.length < indexSz) {
                offset = 0;
                break;
            }
            if (this._decompress && indexU8.length && indexU8[0] !== 0x7b)
                indexU8 = await this._decompress(indexU8);
            offset += indexSz + 4;
            const index = JSON.parse(td.decode(indexU8));
            for (const key in index) {
                this._index[key] = {
                    size: index[key][0],
                    offset: index[key][1]
                };
            }
        } while (false);

        // Now go through every header after the index
        while (true) {
            const hdr = await this._pread(f.maxHeaderSizeU8, offset);

            if (!hdr || hdr.length < f.MagicHeader.SizeU8)
                break;

            // Get header info
            const info = await ser.deserializeHeader(hdr, this._fileId, {
                checkHeader: opts.checkHeaders
            });

            if (!info)
                break;

            if (info.type !== "kvp") {
                offset += info.size;

            } else { // kvp
                offset += f.KVPHeader.SizeU8;

                const keyU8 = await this._pread(info.key, offset);
                if (!keyU8 || keyU8.length < info.key)
                    break;
                offset += info.key;
                const key = td.decode(keyU8);

                // Index it
                this._index[key] = {
                    size: info.body,
                    offset
                };
                offset += info.body + 4;

            }
        }
    }

    /**
     * Get all the keys in this file.
     */
    keys() {
        return Object.keys(this._index);
    }

    /**
     * Get an item. Returns null if the item is absent.
     * @param key  Key to look up.
     */
    async getItem<T>(key: string) {
        const info = this._index[key];
        if (!info)
            return null;

        const body = await this._pread(info.size, info.offset);
        if (!body || body.length < info.size)
            return null;

        return <T> ser.deserializeKVP(body, this._decompress);
    }

    /**
     * @private
     * Reader function.
     */
    private _pread: preadT;

    /**
     * @private
     * File size.
     */
    private _fileSize: number;

    /**
     * @private
     * File identification.
     */
    private _fileId: number;

    /**
     * @private
     * Decompressor.
     */
    private _decompress?: (x: Uint8Array) => Promise<Uint8Array>;

    /**
     * @private
     * Index of file data.
     */
    private _index: Record<string, BodyLoc>;
}

/**
 * A convenience function to create a pread from a Blob or File.
 * @param file  Blob to read.
 */
export function blobToPread(file: Blob) {
    return async (count: number, offset: number) => {
        if (file.size <= offset)
            return null;
        const part = await file.slice(offset, offset + count);
        return new Uint8Array(await part.arrayBuffer());
    };
}

/**
 * A convenience decompression function that uses DecompressionStream if available.
 */
export async function zlibRawDecompress(x: Uint8Array) {
    try {
        const s = new DecompressionStream("deflate-raw");
        const wr = s.writable.getWriter();
        wr.write(x);
        wr.close();

        const rd = s.readable.getReader();
        const parts: Uint8Array[] = [];
        let len = 0;
        while (true) {
            const part = await rd.read();
            if (part.done)
                break;
            parts.push(part.value);
            len += part.value.length;
        }

        const ret = new Uint8Array(len);
        let o = 0;
        for (const part of parts) {
            ret.set(part, o);
            o += part.length;
        }

        return ret;
    } catch (ex) {}

    return x;
}
