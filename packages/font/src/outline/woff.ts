/**
 * WOFF 1 unpacking: a WOFF file is an sfnt with each table zlib-compressed on its own. It is rebuilt as the sfnt it
 * wraps before anything reads it, so the table checks, GPOS kerning and embedding all read the tables opentype.js
 * will parse rather than their compressed bytes.
 */

const WOFF_HEADER_BYTES = 44;
const WOFF_RECORD_BYTES = 20;

/** Is `bytes` a WOFF 1 file (`wOFF`)? */
export const isWoff = (bytes: ArrayBuffer): boolean =>
  bytes.byteLength >= 4 && new DataView(bytes).getUint32(0) === 0x774f4646;

const damaged = (what: string): Error => new Error(`the WOFF file is damaged: ${what}`);
const wrongLength = (): Error => damaged('a table decompresses to a length other than its recorded one');

/** The sfnt a WOFF 1 file wraps, its tables decompressed and laid out 4-byte aligned in directory order. */
export async function sfntFromWoff(bytes: ArrayBuffer): Promise<ArrayBuffer> {
  const view = new DataView(bytes);
  if (bytes.byteLength < WOFF_HEADER_BYTES) throw damaged('its header is cut off');
  const flavor = view.getUint32(4);
  const numTables = view.getUint16(12);
  if (WOFF_HEADER_BYTES + numTables * WOFF_RECORD_BYTES > bytes.byteLength) throw damaged('its table directory is cut off');
  const tables: { tag: number; checksum: number; data: Uint8Array }[] = [];
  for (let i = 0; i < numTables; i++) {
    const at = WOFF_HEADER_BYTES + i * WOFF_RECORD_BYTES;
    const offset = view.getUint32(at + 4);
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    // As opentype.js reads it: a table no shorter compressed than whole is stored whole.
    const stored = compLength < origLength ? compLength : origLength;
    if (offset + stored > bytes.byteLength) throw damaged('a table runs past the end of the file');
    const raw = new Uint8Array(bytes, offset, stored);
    const data = compLength < origLength ? await inflate(raw, origLength) : raw;
    if (data.byteLength !== origLength) throw wrongLength();
    tables.push({ tag: view.getUint32(at), checksum: view.getUint32(at + 16), data });
  }

  let size = 12 + numTables * 16;
  for (const t of tables) size += (t.data.byteLength + 3) & ~3;
  const out = new ArrayBuffer(size);
  const o = new DataView(out);
  const entrySelector = numTables > 0 ? Math.floor(Math.log2(numTables)) : 0;
  const searchRange = numTables > 0 ? 16 * 2 ** entrySelector : 0;
  o.setUint32(0, flavor);
  o.setUint16(4, numTables);
  o.setUint16(6, searchRange);
  o.setUint16(8, entrySelector);
  o.setUint16(10, numTables * 16 - searchRange);
  let at = 12 + numTables * 16;
  tables.forEach((t, i) => {
    const rec = 12 + i * 16;
    o.setUint32(rec, t.tag);
    o.setUint32(rec + 4, t.checksum);
    o.setUint32(rec + 8, at);
    o.setUint32(rec + 12, t.data.byteLength);
    new Uint8Array(out, at, t.data.byteLength).set(t.data);
    at += (t.data.byteLength + 3) & ~3;
  });
  return out;
}

/** `data` inflated, read no further than `limit` bytes: a small table can inflate without bound. */
async function inflate(data: Uint8Array, limit: number): Promise<Uint8Array> {
  let chunks: Uint8Array[];
  let length = 0;
  try {
    const inflater = new DecompressionStream('deflate');
    const writer = inflater.writable.getWriter();
    void writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close()).catch(() => {});
    chunks = [];
    const reader = inflater.readable.getReader();
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      length += r.value.byteLength;
      if (length > limit) {
        void reader.cancel().catch(() => {});
        break;
      }
      chunks.push(r.value);
    }
  } catch (err) {
    throw damaged(`a table does not decompress (${err instanceof Error ? err.message : String(err)})`);
  }
  if (length > limit) throw wrongLength();
  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.byteLength; }
  return out;
}
