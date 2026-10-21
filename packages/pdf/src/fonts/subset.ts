/**
 * A TrueType font program cut down to the glyphs one document draws.
 *
 * Glyph ids do not move: an unused glyph keeps its slot with an empty outline, so `/CIDToGIDMap
 * /Identity`, `/W` and `/ToUnicode` stay keyed by the face's own ids. The tables kept are the ones
 * ISO 32000 lists for an embedded TrueType program (9.9); `cmap`, `name`, `post` and the layout
 * tables are dropped, since a CID-keyed font is addressed by glyph id alone.
 */

const KEPT = ['cvt ', 'fpgm', 'glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'prep'];
const REQUIRED = ['glyf', 'head', 'hhea', 'hmtx', 'loca', 'maxp'];

// Composite glyph component flags (OpenType `glyf`).
const ARG_1_AND_2_ARE_WORDS = 0x0001;
const WE_HAVE_A_SCALE = 0x0008;
const MORE_COMPONENTS = 0x0020;
const WE_HAVE_AN_X_AND_Y_SCALE = 0x0040;
const WE_HAVE_A_TWO_BY_TWO = 0x0080;

type Tables = Map<string, Uint8Array>;

function readTables(sfnt: ArrayBuffer): Tables {
  const view = new DataView(sfnt);
  const out: Tables = new Map();
  for (let i = 0; i < view.getUint16(4); i++) {
    const at = 12 + i * 16;
    const tag = String.fromCharCode(...new Uint8Array(sfnt, at, 4));
    out.set(tag, new Uint8Array(sfnt, view.getUint32(at + 8), view.getUint32(at + 12)));
  }
  for (const tag of REQUIRED) if (!out.has(tag)) throw new Error(`pdf: a TrueType face has no "${tag}" table`);
  return out;
}

const viewOf = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

/** Each glyph's byte range in `glyf`. */
function glyphRanges(t: Tables, numGlyphs: number): [number, number][] {
  const loca = viewOf(t.get('loca')!);
  const long = viewOf(t.get('head')!).getInt16(50) === 1;
  const at = (i: number) => (long ? loca.getUint32(i * 4) : loca.getUint16(i * 2) * 2);
  return Array.from({ length: numGlyphs }, (_, i) => [at(i), at(i + 1)]);
}

/** The glyph ids a composite glyph's components name; empty for a simple glyph. */
function componentsOf(glyph: Uint8Array): number[] {
  if (glyph.byteLength < 10) return [];
  const v = viewOf(glyph);
  if (v.getInt16(0) >= 0) return [];
  const out: number[] = [];
  let at = 10;
  for (;;) {
    const flags = v.getUint16(at);
    out.push(v.getUint16(at + 2));
    at += 4 + (flags & ARG_1_AND_2_ARE_WORDS ? 4 : 2);
    if (flags & WE_HAVE_A_SCALE) at += 2;
    else if (flags & WE_HAVE_AN_X_AND_Y_SCALE) at += 4;
    else if (flags & WE_HAVE_A_TWO_BY_TWO) at += 8;
    if (!(flags & MORE_COMPONENTS)) return out;
  }
}

/** `used`, `.notdef` and every component they reach, inside the face's glyph count. */
function closure(used: Iterable<number>, glyf: Uint8Array, ranges: [number, number][]): Set<number> {
  const keep = new Set<number>();
  const queue = [0, ...used];
  while (queue.length > 0) {
    const gid = queue.pop()!;
    if (keep.has(gid) || gid < 0 || gid >= ranges.length) continue;
    keep.add(gid);
    const [start, end] = ranges[gid]!;
    queue.push(...componentsOf(glyf.subarray(start, end)));
  }
  return keep;
}

function checksum(b: Uint8Array): number {
  const v = viewOf(b);
  let sum = 0;
  for (let i = 0; i < b.byteLength; i += 4) sum = (sum + v.getUint32(i)) >>> 0;
  return sum;
}

const pad4 = (n: number) => (n + 3) & ~3;

/** Writes the tables as an sfnt, with each checksum and `head.checkSumAdjustment` filled in. */
function writeSfnt(tables: Tables): Uint8Array {
  const tags = [...tables.keys()].sort();
  const dirBytes = 12 + tags.length * 16;
  let total = dirBytes;
  for (const tag of tags) total += pad4(tables.get(tag)!.byteLength);
  const out = new Uint8Array(total);
  const v = viewOf(out);
  v.setUint32(0, 0x00010000);
  v.setUint16(4, tags.length);
  const entrySelector = Math.floor(Math.log2(tags.length));
  const searchRange = 2 ** entrySelector * 16;
  v.setUint16(6, searchRange);
  v.setUint16(8, entrySelector);
  v.setUint16(10, tags.length * 16 - searchRange);
  let cursor = dirBytes;
  let headAt = 0;
  tags.forEach((tag, i) => {
    const data = tables.get(tag)!;
    const rec = 12 + i * 16;
    for (let c = 0; c < 4; c++) out[rec + c] = tag.charCodeAt(c);
    out.set(data, cursor);
    v.setUint32(rec + 4, checksum(out.subarray(cursor, cursor + pad4(data.byteLength))));
    v.setUint32(rec + 8, cursor);
    v.setUint32(rec + 12, data.byteLength);
    if (tag === 'head') headAt = cursor;
    cursor += pad4(data.byteLength);
  });
  v.setUint32(headAt + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}

/**
 * `sfnt`, a TrueType (`glyf`) face, holding only the outlines of `used`, `.notdef`, and the
 * components those glyphs are built from. Ids past the face's last glyph are ignored.
 */
export function subsetTrueType(sfnt: ArrayBuffer, used: Iterable<number>): Uint8Array {
  const t = readTables(sfnt);
  const numGlyphs = viewOf(t.get('maxp')!).getUint16(4);
  const glyf = t.get('glyf')!;
  const ranges = glyphRanges(t, numGlyphs);
  const keep = closure(used, glyf, ranges);
  const count = Math.max(...keep) + 1;

  let glyfBytes = 0;
  for (const gid of keep) glyfBytes += pad4(ranges[gid]![1] - ranges[gid]![0]);
  const newGlyf = new Uint8Array(glyfBytes);
  const newLoca = new Uint8Array((count + 1) * 4);
  const loca = viewOf(newLoca);
  let cursor = 0;
  for (let gid = 0; gid < count; gid++) {
    loca.setUint32(gid * 4, cursor);
    if (!keep.has(gid)) continue;
    const [start, end] = ranges[gid]!;
    newGlyf.set(glyf.subarray(start, end), cursor);
    cursor += pad4(end - start);
  }
  loca.setUint32(count * 4, cursor);

  // Every glyph gets a full metric, so `numberOfHMetrics` is the glyph count.
  const hhea = t.get('hhea')!.slice();
  const hmtxIn = viewOf(t.get('hmtx')!);
  const longMetrics = viewOf(hhea).getUint16(34);
  const hmtx = new Uint8Array(count * 4);
  for (let gid = 0; gid < count; gid++) {
    const advance = hmtxIn.getUint16(Math.min(gid, longMetrics - 1) * 4);
    const lsb = gid < longMetrics ? hmtxIn.getInt16(gid * 4 + 2) : hmtxIn.getInt16(longMetrics * 4 + (gid - longMetrics) * 2);
    viewOf(hmtx).setUint16(gid * 4, advance);
    viewOf(hmtx).setInt16(gid * 4 + 2, lsb);
  }
  viewOf(hhea).setUint16(34, count);

  const head = t.get('head')!.slice();
  viewOf(head).setUint32(8, 0);
  viewOf(head).setInt16(50, 1);
  const maxp = t.get('maxp')!.slice();
  viewOf(maxp).setUint16(4, count);

  const out: Tables = new Map([
    ['glyf', newGlyf], ['head', head], ['hhea', hhea], ['hmtx', hmtx], ['loca', newLoca], ['maxp', maxp],
  ]);
  for (const tag of KEPT) if (!out.has(tag) && t.has(tag)) out.set(tag, t.get(tag)!);
  return writeSfnt(out);
}
