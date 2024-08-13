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
    async setItem(key: string, value: any) {
        const buf = await ser.serialize(key, value, this._compress);
        this._buf.push(buf);
        if (this._push)
            this._push();
    }

    /**
     * "Remove" an item. It's not actually possible to remove anything from an
     * append-only store, so this just sets it to null.
     * @param key  Key to remove.
     */
    removeItem(key: string) {
        return this.setItem(key, null);
    }

    /**
     * Indicate that streaming is finished.
     */
    async end() {
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
}
