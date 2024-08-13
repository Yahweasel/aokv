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
    offset: number;
    size: number;
}

/**
 * An append-only key-value store reader. Must be provided with a pread callback
 * that reads a specified part of a file and returns a (possibly short)
 * Uint8Array, or null if past EOF. The pread should not throw.
 */
export class AOKVR {
    constructor(
        /**
         * Function for reading from the input.
         */
        private _pread: (count: number, offset: number) => Promise<Uint8Array | null>,

        /**
         * Optional function to decompress. Must match the input compression.
         */
        private _decompress?: (x: Uint8Array) => Promise<Uint8Array>
    ) {
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
        let offset = 0;
        while (true) {
            const hdr = await this._pread(f.Header.SizeU8, offset);
            offset += f.Header.SizeU8;

            // Check the first header
            if (offset === 0 && !opts.noCheckFirstHeader) {
                if (!hdr || hdr.length < f.Header.SizeU8)
                    throw new Error("Invalid AOKV file");
                const hdrU32 = new Uint32Array(
                    hdr.buffer, hdr.byteOffset, hdr.byteLength / 4
                );
                if (hdrU32[f.Header.Magic0] !== f.aokvHeader[0] ||
                    hdrU32[f.Header.Magic1] !== f.aokvHeader[1]) {
                    throw new Error("Invalid AOKV file");
                }
            }

            if (!hdr || hdr.length < f.Header.SizeU8)
                break;

            // Get header info
            const info = await ser.deserializeHeader(hdr, {
                checkHeader: opts.checkHeaders
            });

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
            offset += info.body;
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
    async getItem(key: string) {
        const info = this._index[key];
        if (!info)
            return null;

        const body = await this._pread(info.size, info.offset);
        if (!body || body.length < info.size)
            return null;

        return ser.deserialize(body, this._decompress);
    }

    /**
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
