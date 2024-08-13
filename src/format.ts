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

export const aokvHeader = [
    0x564b4f41, /* AOKV */
    0x93c1af97  /* magic number */
];

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

export enum Header {
    SizeU8 = 16,
    SizeU32 = 4,
    Magic0 = 0,
    Magic1 = 1,
    KeySz = 2,
    BodySz = 3
}
