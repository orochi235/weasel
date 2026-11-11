/**
 * Font files built for tests: a collection over a real font, a resource fork, and the smallest sfnt.
 */

/**
 * Build a two-member collection out of one real font, by writing a `ttcf`
 * header in front of two copies of its table directory that both point at the
 * same table bytes. That is exactly the structure a real `.ttc` has — N
 * directories over one shared pool — so unpacking either member has to
 * reproduce the original font.
 */
export function synthesizeCollection(single: ArrayBuffer): ArrayBuffer {
  const src = new DataView(single);
  const numTables = src.getUint16(4);
  const dirBytes = 12 + numTables * 16;
  const header = 12 + 2 * 4;               // ttcf header + two member offsets
  const total = header + dirBytes * 2 + single.byteLength;

  const out = new ArrayBuffer(total);
  const dst = new DataView(out);
  const dstBytes = new Uint8Array(out);

  for (const [i, ch] of [...'ttcf'].entries()) dst.setUint8(i, ch.charCodeAt(0));
  dst.setUint16(4, 1); dst.setUint16(6, 0);
  dst.setUint32(8, 2);
  dst.setUint32(12, header);
  dst.setUint32(16, header + dirBytes);

  // The shared table pool: the whole original font, tables reachable at their
  // original offsets plus this shift.
  const poolAt = header + dirBytes * 2;
  dstBytes.set(new Uint8Array(single), poolAt);

  for (const member of [header, header + dirBytes]) {
    dstBytes.set(new Uint8Array(single, 0, dirBytes), member);
    for (let i = 0; i < numTables; i++) {
      const at = member + 12 + i * 16;
      dst.setUint32(at + 8, src.getUint32(12 + i * 16 + 8) + poolAt);
    }
  }
  return out;
}

/** The smallest sfnt that can be told apart: one `name` table holding a
 *  Macintosh-encoded PostScript name. */
export function tinyFont(postScriptName: string): Uint8Array {
  const nameTable = 6 + 12 + postScriptName.length;
  const out = new Uint8Array(12 + 16 + nameTable);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x00010000);
  view.setUint16(4, 1);
  [...'name'].forEach((ch, i) => view.setUint8(12 + i, ch.charCodeAt(0)));
  view.setUint32(12 + 8, 28);
  view.setUint32(12 + 12, nameTable);
  view.setUint16(28 + 2, 1);            // one record
  view.setUint16(28 + 4, 18);           // strings follow it
  view.setUint16(28 + 6, 1);            // platform: Macintosh
  view.setUint16(28 + 6 + 6, 6);        // nameID 6
  view.setUint16(28 + 6 + 8, postScriptName.length);
  [...postScriptName].forEach((ch, i) => view.setUint8(28 + 18 + i, ch.charCodeAt(0)));
  return out;
}

/** A resource fork holding `resources`, each under its four-letter type. */
export function dataFork(resources: ReadonlyArray<{ type: string; data: Uint8Array }>): ArrayBuffer {
  const dataOffset = 256;
  const dataLength = resources.reduce((n, r) => n + 4 + r.data.length, 0);
  const types = [...new Set(resources.map((r) => r.type))];
  const typeList = 2 + types.length * 8;
  const mapLength = 28 + typeList + resources.length * 12;
  const mapOffset = dataOffset + dataLength;
  const out = new ArrayBuffer(mapOffset + mapLength);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, dataOffset);
  view.setUint32(4, mapOffset);
  view.setUint32(8, dataLength);
  view.setUint32(12, mapLength);

  const dataAt = new Map<Uint8Array, number>();
  let cursor = 0;
  for (const r of resources) {
    dataAt.set(r.data, cursor);
    view.setUint32(dataOffset + cursor, r.data.length);
    bytes.set(r.data, dataOffset + cursor + 4);
    cursor += 4 + r.data.length;
  }

  const typeListAt = mapOffset + 28;
  view.setUint16(mapOffset + 24, 28);
  view.setUint16(mapOffset + 26, mapLength);
  view.setUint16(typeListAt, types.length - 1);
  let refAt = typeList;
  types.forEach((type, t) => {
    const mine = resources.filter((r) => r.type === type);
    const entry = typeListAt + 2 + t * 8;
    [...type].forEach((ch, i) => view.setUint8(entry + i, ch.charCodeAt(0)));
    view.setUint16(entry + 4, mine.length - 1);
    view.setUint16(entry + 6, refAt);
    mine.forEach((r, i) => {
      const ref = typeListAt + refAt + i * 12;
      view.setUint16(ref, 128 + i);
      view.setUint16(ref + 2, 0xffff);
      const off = dataAt.get(r.data)!;
      view.setUint8(ref + 5, (off >> 16) & 0xff);
      view.setUint8(ref + 6, (off >> 8) & 0xff);
      view.setUint8(ref + 7, off & 0xff);
    });
    refAt += mine.length * 12;
  });
  return out;
}
