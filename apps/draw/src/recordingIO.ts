/** Recording persistence helpers.
 *
 *  `serializeRecording` produces a gzipped Blob suitable for download;
 *  `deserializeRecording` parses either a gzipped or plain-JSON file back
 *  into a `Recording`. Gzip ratio on real recordings is ~5-10× thanks to
 *  the highly-repetitive structure (same event keys, mostly small ints).
 *
 *  Magic-byte sniffing on load keeps pre-gzip recordings playable.
 */

import type { Recording } from './recorder';

/** RFC 1952 gzip identification: every gzip stream starts with these bytes. */
const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

/** Filename suffix used by the WeaselDraw UI for downloaded gzipped
 *  recordings. Plain `.json` is still readable on load. */
export const RECORDING_EXTENSION = 'json.gz';

const hasCompressionStream = (): boolean =>
  typeof CompressionStream !== 'undefined';

const hasDecompressionStream = (): boolean =>
  typeof DecompressionStream !== 'undefined';

/** Read a user-supplied Blob's bytes via FileReader. Avoids `Blob.arrayBuffer()`
 *  and `Blob.stream()` (which jsdom doesn't expose). Used on the deserialize side
 *  where the input is a real DOM Blob (e.g. from `<input type="file">`), so
 *  FileReader accepts it cleanly across both browsers and jsdom. */
function blobToBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/** Push bytes through a Compression/DecompressionStream, returning the
 *  collected output. Writing and reading are concurrent so we don't
 *  deadlock on streams whose internal queue limit is smaller than the
 *  input. */
async function pumpThrough(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  const writeAndClose = (async () => {
    // TS 5.7's lib.dom types parameterize Uint8Array on its underlying
    // ArrayBuffer kind, so TextEncoder-produced bytes (Uint8Array<ArrayBuffer>)
    // and arbitrary Uint8Array (Uint8Array<ArrayBufferLike>) don't match
    // structurally even though both work at runtime. Casting at the
    // boundary keeps callers from leaking that detail.
    await writer.write(bytes as unknown as BufferSource);
    await writer.close();
  })();
  const out = new Uint8Array(await new Response(stream.readable).arrayBuffer());
  await writeAndClose;
  return out;
}

/** Serialize a recording to a Blob. Returns a gzipped blob when the
 *  browser supports `CompressionStream` (all evergreen browsers); falls
 *  back to plain JSON otherwise. The `type` field of the returned blob
 *  is `'application/gzip'` for the compressed path and
 *  `'application/json'` for the fallback so callers can choose an
 *  appropriate `download` filename. */
export async function serializeRecording(rec: Recording): Promise<Blob> {
  const json = JSON.stringify(rec);
  if (!hasCompressionStream()) {
    return new Blob([json], { type: 'application/json' });
  }
  const compressed = await pumpThrough(
    new TextEncoder().encode(json),
    new CompressionStream('gzip'),
  );
  return new Blob([compressed as BlobPart], { type: 'application/gzip' });
}

/** Parse a recording Blob (or File from an `<input type="file">`) back
 *  into a `Recording`. Sniffs the gzip magic bytes; falls through to
 *  plain JSON parsing when the magic isn't present, so recordings saved
 *  before gzip rolled out still load. */
export async function deserializeRecording(blob: Blob): Promise<Recording> {
  const bytes = await blobToBytes(blob);
  const isGzipped =
    bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;
  if (isGzipped) {
    if (!hasDecompressionStream()) {
      throw new Error(
        'Gzipped recording but the browser lacks DecompressionStream support.',
      );
    }
    const decompressed = await pumpThrough(bytes, new DecompressionStream('gzip'));
    return JSON.parse(new TextDecoder().decode(decompressed)) as Recording;
  }
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as Recording;
}
