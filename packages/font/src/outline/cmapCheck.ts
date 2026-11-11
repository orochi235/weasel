/**
 * A check of the `cmap` subtable opentype.js will read, run before it does.
 *
 * opentype.js writes one entry per code point a segment or group names, and trusts the counts: a format 12 group
 * whose end a damaged byte moves to 0xffffffff writes until the heap runs out, and overlapping format 4 segments
 * write hundreds of times what the face maps. So the subtable is refused when its segments or groups run past the
 * table, or name, between them, more code points than its format can map.
 */

const bad = (what: string): Error => new Error(`the font's cmap table is damaged: ${what}`);

/** Code points a format 4 subtable can map, and a format 12 or 13 one. */
const BMP = 0x10000;
const UNICODE = 0x110000;

/** Throws unless the subtable of `cmap` (the table's bytes alone) that opentype.js picks names at most the code points
 *  its format can map, inside the table. A table it picks no subtable from passes: opentype.js refuses it itself. */
export function checkCmap(cmap: DataView): void {
  const at = pickedSubtable(cmap);
  if (at === null) return;
  const u16 = (o: number) => (o + 2 <= cmap.byteLength ? cmap.getUint16(o) : null);
  const u32 = (o: number) => (o + 4 <= cmap.byteLength ? cmap.getUint32(o) : null);
  const format = u16(at);
  if (format === 4) {
    const segCount = (u16(at + 6) ?? 0) >> 1;
    if (at + 16 + segCount * 8 > cmap.byteLength) throw bad('its format 4 segments run past the table');
    let total = 0;
    for (let i = 0; i < segCount - 1; i++) {
      total += Math.max(0, cmap.getUint16(at + 14 + i * 2) - cmap.getUint16(at + 16 + segCount * 2 + i * 2) + 1);
    }
    if (total > BMP) throw bad(`its format 4 segments name ${total} code points`);
  } else if (format === 12 || format === 13) {
    const groups = u32(at + 12) ?? 0;
    if (at + 16 + groups * 12 > cmap.byteLength) throw bad(`its format ${format} groups run past the table`);
    let total = 0;
    for (let i = 0; i < groups && total <= UNICODE; i++) {
      total += Math.max(0, cmap.getUint32(at + 20 + i * 12) - cmap.getUint32(at + 16 + i * 12) + 1);
    }
    if (total > UNICODE) throw bad(`its format ${format} groups name more than ${UNICODE} code points`);
  }
}

const PLATFORM_0 = [0, 1, 2, 3, 4, 6];
const PLATFORM_3 = [0, 1, 10];

/** Where the subtable opentype.js 2 reads starts: the last encoding record, by its order, of a Unicode or Macintosh
 *  Roman encoding, past any whose offset is 0. */
function pickedSubtable(cmap: DataView): number | null {
  if (cmap.byteLength < 4) return null;
  const count = cmap.getUint16(2);
  if (4 + count * 8 > cmap.byteLength) throw bad('its encoding records run past the table');
  for (let i = count - 1; i >= 0; i--) {
    const rec = 4 + i * 8;
    const platform = cmap.getUint16(rec);
    const encoding = cmap.getUint16(rec + 2);
    if ((platform === 3 && PLATFORM_3.includes(encoding)) || (platform === 0 && PLATFORM_0.includes(encoding))
      || (platform === 1 && encoding === 0)) {
      const at = cmap.getUint32(rec + 4);
      if (at === 0) continue;
      if (at >= cmap.byteLength) throw bad('its subtable starts past the table');
      return at;
    }
  }
  return null;
}
