/**
 * WOFF 1 unpacking: a WOFF file is an sfnt with each table zlib-compressed on its own. It is rebuilt as the sfnt it
 * wraps before anything reads it, so the table checks, GPOS kerning and embedding all read the tables opentype.js
 * will parse rather than their compressed bytes.
 */

const WOFF_HEADER_BYTES = 44;
const WOFF_RECORD_BYTES = 20;
/** zlib's most a deflate stream can expand: 1032 bytes out per byte in. */
const DEFLATE_MAX_RATIO = 1032;

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
  const records = Array.from({ length: numTables }, (_, i) => {
    const at = WOFF_HEADER_BYTES + i * WOFF_RECORD_BYTES;
    const compLength = view.getUint32(at + 8);
    const origLength = view.getUint32(at + 12);
    return {
      tag: view.getUint32(at), offset: view.getUint32(at + 4), compLength, origLength, checksum: view.getUint32(at + 16),
      // As opentype.js reads it: a table no shorter compressed than whole is stored whole.
      stored: compLength < origLength ? compLength : origLength,
    };
  });
  for (const r of records) if (r.offset + r.stored > bytes.byteLength) throw damaged('a table runs past the end of the file');
  checkDistinct(records);
  if (records.some((r) => r.compLength < r.origLength && r.origLength > r.compLength * DEFLATE_MAX_RATIO)) {
    throw damaged('a table records a length its compressed data cannot hold');
  }

  let size = 12 + numTables * 16;
  for (const r of records) size += (r.origLength + 3) & ~3;
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
  for (const [i, r] of records.entries()) {
    const rec = 12 + i * 16;
    o.setUint32(rec, r.tag);
    o.setUint32(rec + 4, r.checksum);
    o.setUint32(rec + 8, at);
    o.setUint32(rec + 12, r.origLength);
    const raw = new Uint8Array(bytes, r.offset, r.stored);
    const slot = new Uint8Array(out, at, r.origLength);
    if (r.compLength < r.origLength) await inflateInto(raw, slot);
    else slot.set(raw);
    at += (r.origLength + 3) & ~3;
  }
  return out;
}

/** Refuse a table listed twice or tables sharing stored bytes, so one stored table cannot be inflated more than once. */
function checkDistinct(records: readonly { tag: number; offset: number; stored: number }[]): void {
  const tags = new Set<number>();
  for (const r of records) {
    if (tags.has(r.tag)) throw damaged('a table is listed twice');
    tags.add(r.tag);
  }
  const placed = records.filter((r) => r.stored > 0).sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < placed.length; i++) {
    if (placed[i]!.offset < placed[i - 1]!.offset + placed[i - 1]!.stored) throw damaged('two of its tables overlap');
  }
}

/** Inflate `data` into `slot`, refusing a stream that inflates to any length but the slot's. */
async function inflateInto(data: Uint8Array, slot: Uint8Array): Promise<void> {
  let length = 0;
  try {
    const inflater = new DecompressionStream('deflate');
    const writer = inflater.writable.getWriter();
    void writer.write(data as Uint8Array<ArrayBuffer>).then(() => writer.close()).catch(() => {});
    const reader = inflater.readable.getReader();
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      if (length + r.value.byteLength > slot.byteLength) {
        void reader.cancel().catch(() => {});
        length = Infinity;
        break;
      }
      slot.set(r.value, length);
      length += r.value.byteLength;
    }
  } catch (err) {
    throw damaged(`a table does not decompress (${err instanceof Error ? err.message : String(err)})`);
  }
  if (length !== slot.byteLength) throw wrongLength();
}
