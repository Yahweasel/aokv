// SPDX-License-Identifier: ISC
/*!
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

// AOKV
export const aokvMagic = 0x564b4f41;

// Magic number: key-value pair
export const aokvMagicKVP = 0x93c1af97;

// Magic number: index
export const aokvMagicIndex = 0x93c1af98;

// Maximum magic number allowed
export const aokvMagicMax = 0x93c1b097;

export enum MagicHeader {
    SizeU8 = 12,
    SizeU32 = 3,
    Magic0 = 0,
    Magic1 = 1,
    BlockSz = 2
}

export enum KVPHeader {
    SizeU8 = MagicHeader.SizeU8 + 4,
    SizeU32 = MagicHeader.SizeU32 + 1,
    KeySz = 3
}

export const maxHeaderSizeU8 = KVPHeader.SizeU8;
export const maxHeaderSizeU32 = KVPHeader.SizeU32;

export enum SerType {
    JSON = 0,
    TypedArray = 1,
    ArrayBuffer = 2
};

export interface Descriptor {
    /**
     * Type of the serialized data.
     */
    t: SerType,

    /**
     * If typed array or array buffer, type of the typed array.
     */
    a?: string,

    /**
     * If JSON, the data itself.
     */
    d?: any
}
