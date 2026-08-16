/**
 * TrueType/OpenType **collection** unpacking.
 *
 * `queryLocalFonts()` hands back the font *file* behind a face, and on macOS
 * a large share of the interesting ones — Helvetica, Times, Courier, Menlo —
 * are `.ttc` collections holding every weight and style in a single file with
 * one shared glyph store. A collection is not a font: its header is `ttcf`
 * rather than an sfnt version, so every parser worth using rejects it, and
 * opentype.js is no exception (it recognizes `\0\1\0\0`, `true`, `typ1`,
 * `OTTO`, `wOFF` and throws on anything else).
 *
 * The fix is mechanical, because a collection is just N table directories
 * over one pool of tables: pick the directory whose PostScript name matches
 * the face we were asked for, then re-emit it as a standalone sfnt with the
 * tables copied and the offsets rewritten. Nothing is re-encoded — the table
 * bytes are the same bytes — so the result parses identically to a font that
 * had shipped on its own.
 *
 * Kept separate from `opentypeParser.ts` so the collection handling is
 * testable without a parser, and so swapping the parser later doesn't drag
 * this along.
 *
 * ### Why this lives here rather than upstream or in a bigger library
 *
 * Decided 2026-07-31, after looking at both alternatives — recorded so this
 * doesn't get "tidied up" into one of them later.
 *
 * The upstream fix is genuinely small: `parseOpenTypeTableEntries` hardcodes
 * `p = 12`, so the only thing opentype.js cannot do is be *told* the table
 * directory starts somewhere other than byte zero. Table records already
 * carry absolute offsets and the parser already reads them from a
 * whole-buffer view, so a `dirOffset` parameter and a `ttcf` branch would be
 * about ten lines. (Typr takes an offset in `readFONT` and gets collections
 * for free — same capability, one better-chosen signature.) It would make a
 * good PR. It would also not help for a while: opentype.js sat untouched from
 * 2021 to 2026, and we would carry this file until a release landed anyway.
 *
 * fontkit handles `.ttc` and `.dfont` natively, and WOFF2 besides — but it is
 * ~5.6 MB unpacked across nine dependencies (brotli, unicode-trie, dfa, …).
 * That is a shaping engine, and all this tier wants is a glyph outline.
 *
 * This version has an advantage over both: it runs *before* anything parses,
 * so it is parser-agnostic and survives swapping opentype.js out.
 *
 * **Known gap: `.dfont`** (Datafork TrueType) is not unpacked — its sfnt
 * tables live inside a Macintosh resource map, which is a second container
 * format on top of the one above. `isDataForkFont` recognizes it and
 * `sfntFromCollection` throws by name, so the face degrades to the SDF tier
 * saying why; the registry's `warnOnce` carries the message. Not currently
 * reachable on macOS, whose system font directories are 204 `.ttf` / 128
 * `.ttc` / 38 `.otf` and no `.dfont`; it is a real format on older systems.
 */

const SFNT_HEADER_BYTES = 12;
const TABLE_RECORD_BYTES = 16;

function tagAt(view: DataView, offset: number): string {
  return String.fromCharCode(
    view.getUint8(offset), view.getUint8(offset + 1),
    view.getUint8(offset + 2), view.getUint8(offset + 3),
  );
}

/** Is `bytes` a font collection rather than a single font? */
export function isFontCollection(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < 4) return false;
  return tagAt(new DataView(bytes), 0) === 'ttcf';
}

/** Every signature that opens a font file this tier can hand to a parser. */
const FONT_SIGNATURES: ReadonlySet<string> = new Set([
  '\x00\x01\x00\x00', 'true', 'typ1', 'OTTO', 'ttcf', 'wOFF', 'wOF2',
]);

const RESOURCE_HEADER_BYTES = 16;

/**
 * Is `bytes` a Datafork TrueType file (`.dfont`)?
 *
 * A `.dfont` is a bare Macintosh resource fork written to the data fork, so
 * unlike every other font format it opens with no signature — just the
 * resource header's four big-endian offsets. It is recognized by those
 * adding up, which is why the signature check has to run first: an sfnt's
 * header bytes are numbers too, and nothing stops them from coincidentally
 * being consistent.
 *
 * Detection only. Reading the `sfnt` resources out of the map is the rest of
 * the job and is not implemented — the point is that the face declines the
 * outline tier by name instead of dying on an unrecognized-signature message
 * that never mentions the format.
 */
export function isDataForkFont(bytes: ArrayBuffer): boolean {
  if (bytes.byteLength < RESOURCE_HEADER_BYTES) return false;
  const view = new DataView(bytes);
  if (FONT_SIGNATURES.has(tagAt(view, 0))) return false;
  const dataOffset = view.getUint32(0);
  const mapOffset = view.getUint32(4);
  const dataLength = view.getUint32(8);
  const mapLength = view.getUint32(12);
  return dataOffset >= RESOURCE_HEADER_BYTES
    && dataOffset + dataLength === mapOffset
    && mapOffset + mapLength <= bytes.byteLength;
}

interface TableRecord { tag: string; offset: number; length: number; checksum: number }

function readTableDirectory(view: DataView, dirOffset: number): TableRecord[] {
  const numTables = view.getUint16(dirOffset + 4);
  const records: TableRecord[] = [];
  for (let i = 0; i < numTables; i++) {
    const at = dirOffset + SFNT_HEADER_BYTES + i * TABLE_RECORD_BYTES;
    records.push({
      tag: tagAt(view, at),
      checksum: view.getUint32(at + 4),
      offset: view.getUint32(at + 8),
      length: view.getUint32(at + 12),
    });
  }
  return records;
}

/**
 * PostScript name (`name` table, nameID 6) of the sub-font at `dirOffset`,
 * or `null` when it carries none.
 *
 * A deliberately minimal reader: identifying which member of a collection to
 * unpack is the only thing needed here, and a full `name` parser would be a
 * second implementation of something the real parser does properly once the
 * font is standalone. PostScript names are ASCII by specification, so both
 * the Macintosh (single-byte) and Windows (UTF-16BE) encodings reduce to
 * "take every byte that isn't a zero pad".
 */
function postScriptNameAt(view: DataView, records: readonly TableRecord[]): string | null {
  const name = records.find((r) => r.tag === 'name');
  if (!name) return null;
  const base = name.offset;
  const count = view.getUint16(base + 2);
  const stringOffset = view.getUint16(base + 4);
  for (let i = 0; i < count; i++) {
    const rec = base + 6 + i * 12;
    if (view.getUint16(rec + 6) !== 6) continue; // nameID 6 === PostScript name
    const length = view.getUint16(rec + 8);
    const offset = view.getUint16(rec + 10);
    let out = '';
    for (let b = 0; b < length; b++) {
      const code = view.getUint8(base + stringOffset + offset + b);
      if (code !== 0) out += String.fromCharCode(code);
    }
    if (out.length > 0) return out;
  }
  return null;
}

/** Re-emit the table directory at `dirOffset` as a standalone sfnt buffer. */
function extractFont(source: ArrayBuffer, view: DataView, dirOffset: number): ArrayBuffer {
  const records = readTableDirectory(view, dirOffset);
  // Tables are copied 4-byte aligned, which is what the format requires and
  // what every checksum in the directory was computed over.
  const padded = (n: number): number => (n + 3) & ~3;
  let total = SFNT_HEADER_BYTES + records.length * TABLE_RECORD_BYTES;
  for (const r of records) total += padded(r.length);

  const out = new ArrayBuffer(total);
  const dst = new DataView(out);
  const dstBytes = new Uint8Array(out);
  const srcBytes = new Uint8Array(source);

  dst.setUint32(0, view.getUint32(dirOffset));           // sfntVersion
  dst.setUint16(4, records.length);
  // searchRange / entrySelector / rangeShift are a binary-search hint over the
  // table records. Recomputed rather than copied: the member directory's
  // values describe its own table count, which is usually but not always the
  // same, and a wrong hint is a parser walking off the end of the directory.
  const entrySelector = Math.floor(Math.log2(records.length));
  const searchRange = 2 ** entrySelector * 16;
  dst.setUint16(6, searchRange);
  dst.setUint16(8, entrySelector);
  dst.setUint16(10, records.length * 16 - searchRange);

  let cursor = SFNT_HEADER_BYTES + records.length * TABLE_RECORD_BYTES;
  records.forEach((r, i) => {
    const at = SFNT_HEADER_BYTES + i * TABLE_RECORD_BYTES;
    for (let b = 0; b < 4; b++) dst.setUint8(at + b, r.tag.charCodeAt(b));
    dst.setUint32(at + 4, r.checksum);
    dst.setUint32(at + 8, cursor);
    dst.setUint32(at + 12, r.length);
    dstBytes.set(srcBytes.subarray(r.offset, r.offset + r.length), cursor);
    cursor += padded(r.length);
  });
  return out;
}

/**
 * Standalone font bytes for one member of a collection.
 *
 * `postScriptName` selects the member; when it is absent or matches nothing,
 * the first member is returned. Falling back rather than failing is
 * deliberate — the name comes from `FontData.postscriptName`, and a browser
 * that reports it differently from the `name` table should degrade to "some
 * weight of the right family", not to no text at all. The caller sees which
 * it got via the returned `matched` flag.
 *
 * Passing a single font through is a no-op, so this is safe to call on any
 * bytes.
 */
export function sfntFromCollection(
  bytes: ArrayBuffer,
  postScriptName?: string,
): { bytes: ArrayBuffer; matched: boolean } {
  if (isDataForkFont(bytes)) {
    throw new Error(
      'Datafork TrueType (.dfont) is not supported — the outline tier reads sfnt '
      + 'tables and a .dfont holds them inside a Macintosh resource map.',
    );
  }
  if (!isFontCollection(bytes)) return { bytes, matched: true };

  const view = new DataView(bytes);
  const numFonts = view.getUint32(8);
  if (numFonts === 0) throw new Error('font collection contains no fonts');

  const offsets: number[] = [];
  for (let i = 0; i < numFonts; i++) offsets.push(view.getUint32(12 + i * 4));

  if (postScriptName) {
    for (const dirOffset of offsets) {
      const records = readTableDirectory(view, dirOffset);
      if (postScriptNameAt(view, records) === postScriptName) {
        return { bytes: extractFont(bytes, view, dirOffset), matched: true };
      }
    }
  }
  return { bytes: extractFont(bytes, view, offsets[0]), matched: !postScriptName };
}
