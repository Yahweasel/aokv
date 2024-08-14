This is an append-only key-value store. It is a key-value store that you can
write to (but only by appending), and then, after finishing writing, read back
like any normal key-value store.


## What and why?

The main use case of this is to deal with the fragmented world of storing data
from a browser.

You can store data in `localStorage`, an indexed DB, or the origin-private
filesystem, but that storage is extremely fragile. It gets destroyed when the
browser feels like it. That's bad for the web app, and bad for the user.

You can store data in cloud storage, but that requires a whole extra interface
and sometimes-onerous auditing and licensing. Plus, it's not really a solution
to storing user data if you don't allow them to store it themselves.

On Chrome, you can store data in a local directory, by using
`showDirectoryPicker`. This is one of the better options, but has some
fragilities:

 * It's a Chrome-specific option (plus all the Chomealikes).
 * The user interface can be extremely confusing.
 * The `createWritable` interface for files is fragile to early cancellation: if
   you cancel writing (e.g. by navigating away from the page), the intermediary
   file is deleted. So, you need to make sure to write many small files, instead
   of several large files or any streaming files.

(The previous two options can be implemented by my own
[nonlocalForage](https://github.com/Yahweasel/nonlocal-forage) )

Or, you can download the data with something like
[StreamSaver.js](https://github.com/jimmywarting/StreamSaver.js). But, if your
data isn't naturally file-like, or has many subparts, what exactly do you put
*into* that stream?

AOKV is the answer to that question. It provides an interface for using a stream
of bytes as a write-only key-value store. That stream can be streamed as a
downloaded file with something like StreamSaver.js. The user can then select
that file later (and get a `File` object), and AOKV provides an interface to use
that as a read-only key-value store. The data is saved eagerly, so early
interruption still yields a valid store.

Note that if you're using this with a download, as suggested above, and the
download is either explicitly canceled or implicitly canceled (e.g., due to
running out of disk space), most browsers *delete* the intermediary file, so all
data is lost. Oh well, can't fix everything...


## How

`aokv.js` exposes an object `AOKV` (if importing or using `require`, this object
is the export). `AOKV.AOKVW` is a class for writing AOKV streams, and
`AOKV.AOKVR` is a class for reading AOKV streams.

`aokvr.js` exposes `AOKVR` with only the reading side (`AOKVR.AOKVR`), and
`aokvw.js` exposes `AOKVW` with only the writing side (`AOKVW.AOKVW`). You can
also import this module as `"aokv/read"` to get only the reading side, or
`"aokv/write"` to get only the writing side.


## Writing

Create an AOKV writer instance with `w = new AOKV.AOKVW();`. `AOKVW` takes an
optional parameter: a compression function, which will compress each entry in
the store. If provided, it should be of type `(x:Uint8Array) =>
Promise<Uint8Array>`, i.e., an asynchronous `Uint8Array`-to-`Uint8Array`
function.

The `AOKVW` object exposes its output as the field `stream` (e.g., `w.stream`),
which is a `ReadableStream` of `Uint8Array` chunks. You should start reading
from this stream as soon as you create the `AOKVW`, so data doesn't buffer.

To set an item in the store, use `await w.setItem(key, value);`. The key must be
a string, and the value can be anything JSON-serializable, or any ArrayBuffer or
TypedArray. This and many other names are chosen to be familiar to users of
[localForage](https://localforage.github.io/localForage/)

`await w.removeItem(key);` is provided to “remove” an item from the store, but
it's important to note that nothing can truly be removed, since the store is
only ever appended to. Instead, this is just a convenience function to set the
item to `null`, as `getItem` (below) returns `null` for items that are not in
the store.

`AOKVW` also provides a `size` method, which returns the amount of data that's
been written to the stream so far, in bytes, e.g., `w.size()`. You do not need
to `await w.size()`.

Because AOKV files are *append-only* stores, you should be mindful of how you
use them. If you set the same key over and over again, you will take a lot of
space, because the previous, discarded values are all still saved. The size is
monotonically increasing.

To end the stream, use `await w.end()`. This is technically optional, as
truncated AOKV files are valid, but probably useful for whatever you're using to
read the stream.


## Reading

Create an AOKV reader instance with `r = new AOKV.AOKVR(pread, size);`. `pread` is a
function of the form `(count: number, offset: number) => Promise<Uint8Array |
null>` which should read `count` bytes from `offset`, returning the read data as
a `Uint8Array`. A short read or `null` are acceptable returns for end-of-file.
`size` is the size of the file, in bytes. `AOKVR` takes an optional third
parameter, a decompression function, which should be the reverse of the
compression function provided to `AOKVW`.

As it is common to use `AOKVR` with `Blob`s (or `File`s, which are a subtype of
`Blob`), a convenience function is provided to create a `pread` for `Blob`s,
`AOKV.blobToPread`. Use it like so: `r = new
AOKV.AOKVR(AOKV.blobToPread(file), file.size);`.

Once you've created the `AOKVR` instance, before accessing data, you must index
the file. Do so with `await r.index();`. `r.index` has some options to control
how it validates that this is an AOKV file, but they should usually be left as
default.

After indexing, there are two accessors available. Use `r.keys()` to get an
array of all the keys in the store. It is not necessary to `await r.keys()`, as
the indexing process makes the list of available keys eagerly.

Use `await r.getItem(key)` to get the item associated with the given key. This
function will return `null` if the key is not set, if the data for this key was
truncated, or (of course) if it was set to `null`.

Because AOKV files are *append-only* stores, every value assigned to any key is
technically available in the file. The reader interface only exposes the last
one (which is the standard behavior of a key-value store).


## Format

AOKV files are written in native endianness, so typically little-endian.

An AOKV file consists of a sequence of AOKV blocks. There is no header to the
entire AOKV file; instead, an AOKV file can be recognized by the header to the
first block in the file. There are two types of AOKV blocks: key-value pair
blocks, and index blocks.

Each block consists of a header, content, and footer. The header consists of
three 32-bit unsigned integers. The first two are just identification magic, and
the third is the size of the entire block, including the header and footer. The
first magic word is always 0x564b4f41. Note that in little-endian, the first
value is the ASCII string `"AOKV"`.

The footer is the distance, in bytes, back from the footer itself to the nearest
index block.

### KVP blocks

The content of a key-value pair block consists of the length of the key in
bytes, the key, and a body.

The key length is encoded as a 32-bit unsigned integer.

The key is simply a UTF-8 string.

The length of the body is inferred from the length of the block and the length
of the key.

The body consists of the length of the descriptor in bytes, the descriptor, and
a “post”. The length of the descriptor is written as a 32-bit unsigned integer.

The descriptor is a serialized JSON object with the following format:

```typescript
interface Descriptor {
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
```

The `t` field is 0 for JSON, 1 for a TypedArray, and 2 for an ArrayBuffer. If
the serialized data is JSON, then its entire serialized value is in the
descriptor (the `d` field), and the post is absent.

If the serialized value is a TypedArray, then the `a` field specifies (by
string) which type, e.g. `"Uint8ClampedArray"`. The post is the raw data in the
typed array. Only the accessible portion is stored, not the entire ArrayBuffer.

If the serialized value is an ArrayBuffer, then neither `a` or `d` are used in
the descriptor, and the post is the raw data in the buffer.

If compression is used, the body is compressed. The header and key are not, for
fast indexing.

Even if compression is used, the data is written uncompressed if compression
didn't actually reduce the size of the body. Because every descriptor starts
with `{`, it is possible to determine if a body is compressed by checking if the
fifth byte is `{`. Because this is the method to check for compression, if the
compression function *happens* to output a byte sequence in which the fifth byte
is `{`, then it isn't used, and the data is written uncompressed, even if
compression would have reduced the size.

### Index blocks

An index block is an index of all of the key-value pairs written so far.

The content of an index block is the index, which is a JSON-encoded mapping of
keys to [size, offset] pairs. The sizes and offsets are absolute.

It is possible to recreate any AOKV file's index without an index block, but for
large files, it is much faster to recreate with it.

Indices can be compressed, like the body of KVP blocks.
