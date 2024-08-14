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
import * as ser from "./serializer";

/**
 * An append-only key-value store writer. The stream in this class is the data
 * to write to the file.
 */
export class AOKVW {
    constructor(
        /**
         * Function to compress a data chunk.
         */
        private _compress?: (x: Uint8Array) => Promise<Uint8Array>
    ) {
        this._buf = [];
        this._size = 0;
        this._index = Object.create(null);
        this._lastIndex = 1;
        this._kvpSize = 0;
        this._indexSize = 0;

        this.stream = new ReadableStream<Uint8Array>({
            pull: async (controller) => {
                while (!this._buf.length) {
                    await new Promise<void>(res => this._push = res);
                    this._push = void 0;
                }
                const ret = this._buf.shift();
                if (ret)
                    controller.enqueue(ret);
                else
                    controller.close();
            }
        });
    }

    /**
     * Set an item.
     * @param key  Key to set.
     * @param value  Value to assign to the key. Must be serializable.
     */
    async setItem<T>(key: string, value: T) {
        const buf = await ser.serialize(
            this._lastIndex, key, value, this._compress
        );
        this._index[key] = [
            buf.body,
            this._size + buf.hdr + buf.key,
        ];

        this._size += buf.buf.length;
        this._lastIndex += buf.buf.length;
        this._kvpSize += buf.buf.length;

        this._buf.push(buf.buf);
        if (this._push)
            this._push();

        await this._maybeWriteIndex();

        return value;
    }

    /**
     * "Remove" an item. It's not actually possible to remove anything from an
     * append-only store, so this just sets it to null.
     * @param key  Key to remove.
     */
    async removeItem(key: string) {
        await this.setItem(key, null);
    }

    /**
     * @private
     * Write the index if we should.
     */
    private async _maybeWriteIndex() {
        if (
            this._lastIndex >= 0x40000000 ||
            (
                this._kvpSize >= 0x10000 &&
                this._kvpSize >= this._indexSize * 64
            )
        ) {
            await this._writeIndex();
        }
    }

    /**
     * @private
     * Write the index.
     */
    private async _writeIndex() {
        const buf = await ser.serializeIndex(this._index, this._compress);

        this._size += buf.length;
        this._lastIndex = buf.length;
        this._indexSize += buf.length;

        this._buf.push(buf);
        if (this._push)
            this._push();
    }

    /**
     * Get the total size of all data written thusfar, in bytes.
     */
    size() {
        return this._size;
    }

    /**
     * Indicate that streaming is finished.
     */
    async end() {
        await this._writeIndex();
        this._buf.push(null);
        if (this._push)
            this._push();
    }

    /**
     * Stream of data being written.
     */
    stream: ReadableStream<Uint8Array>;

    /**
     * @private
     * Buffer of chunks to write.
     */
    private _buf: (Uint8Array | null)[];

    /**
     * @private
     * Callback if the stream is currently waiting.
     */
    private _push?: () => void;

    /**
     * @private
     * Total size of all data written thusfar.
     */
    private _size: number;

    /**
     * @private
     * Index of all data in the AOKV.
     */
    private _index: Record<string, [number, number]>;

    /**
     * @private
     * Offset since the index was last written.
     */
    private _lastIndex: number;

    /**
     * @private
     * Total amount of KVP data that has been written.
     */
    private _kvpSize: number;

    /**
     * @private
     * Total amount of index data that has been written.
     */
    private _indexSize: number;
}
