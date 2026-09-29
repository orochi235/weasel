/**
 * Pair kerning read straight from a font's GPOS `kern` feature.
 *
 * opentype.js reads GPOS kerning only from lookups of type 2 and skips type 9
 * (Extension), which is where a large font puts its main kerning — Inter's
 * class-based pairs all sit behind one. What it misses is most of the kerning
 * a browser applies: "AVATAR" at 72px sets 22px narrower in every engine than
 * the sum of its advances. So the pair lookups are read here, extensions
 * unwrapped, and both the outline tier and the atlas generator take kerning
 * from this one reader.
 *
 * Scope: horizontal pair adjustment (PairPos formats 1 and 2), first glyph's
 * XAdvance, lookups of every `kern` feature in LookupList order regardless of
 * script. Contextual and mark positioning are out of scope — they don't
 * change a Latin run's width.
 *
 * Self-contained on purpose: `scripts/gen-font.ts` imports it under plain
 * Node, which strips types but resolves nothing else.
 */

/** Kerning between two glyph ids, in font units; negative pulls them together. */
export type PairKerning = (left: number, right: number) => number;

/**
 * Read the `kern` feature's pair lookups from a single-font sfnt (not a
 * collection). `null` when the font has no GPOS table or no `kern` feature —
 * the caller then falls back to the legacy `kern` table.
 */
export function gposPairKerning(bytes: ArrayBuffer): PairKerning | null {
  const v = new DataView(bytes);
  // A WOFF's tables are compressed; opentype.js reads those, this does not.
  const version = v.byteLength >= 12 ? tag(v, 0) : '';
  if (version !== '\0\x01\0\0' && version !== 'true' && version !== 'OTTO') return null;
  const gpos = tableOffset(v, 'GPOS');
  if (gpos === null) return null;

  const featureList = gpos + v.getUint16(gpos + 6);
  const lookupList = gpos + v.getUint16(gpos + 8);
  const lookupIndexes = new Set<number>();
  const featureCount = v.getUint16(featureList);
  for (let i = 0; i < featureCount; i++) {
    const rec = featureList + 2 + i * 6;
    if (tag(v, rec) !== 'kern') continue;
    const feature = featureList + v.getUint16(rec + 4);
    const count = v.getUint16(feature + 2);
    for (let j = 0; j < count; j++) lookupIndexes.add(v.getUint16(feature + 4 + j * 2));
  }
  if (lookupIndexes.size === 0) return null;

  const lookups: number[][] = [];
  for (const index of [...lookupIndexes].sort((a, b) => a - b)) {
    const lookup = lookupList + v.getUint16(lookupList + 2 + index * 2);
    const type = v.getUint16(lookup);
    const subtables: number[] = [];
    const count = v.getUint16(lookup + 4);
    for (let j = 0; j < count; j++) {
      let sub = lookup + v.getUint16(lookup + 6 + j * 2);
      let subType = type;
      if (type === 9) {
        subType = v.getUint16(sub + 2);
        sub += v.getUint32(sub + 4);
      }
      if (subType === 2) subtables.push(sub);
    }
    if (subtables.length > 0) lookups.push(subtables);
  }

  const memo = new Map<number, number>();
  return (left, right) => {
    const key = left * 0x10000 + right;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    let total = 0;
    for (const subtables of lookups) {
      for (const sub of subtables) {
        const value = pairValue(v, sub, left, right);
        if (value !== null) { total += value; break; }
      }
    }
    memo.set(key, total);
    return total;
  };
}

function tag(v: DataView, at: number): string {
  return String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
}

function tableOffset(v: DataView, name: string): number | null {
  const count = v.getUint16(4);
  for (let i = 0; i < count; i++) {
    const rec = 12 + i * 16;
    if (tag(v, rec) === name) return v.getUint32(rec + 8);
  }
  return null;
}

/** Bytes in a ValueRecord of this format: two per set bit. */
function valueSize(format: number): number {
  let n = 0;
  for (let f = format; f; f >>= 1) n += f & 1;
  return n * 2;
}

/** XAdvance of the ValueRecord at `at`, or 0 when the format carries none. */
function xAdvance(v: DataView, at: number, format: number): number {
  if (!(format & 0x4)) return 0;
  return v.getInt16(at + (format & 0x1 ? 2 : 0) + (format & 0x2 ? 2 : 0));
}

/** The subtable's adjustment for this pair, or `null` when it does not apply. */
function pairValue(v: DataView, sub: number, left: number, right: number): number | null {
  const format = v.getUint16(sub);
  const covIndex = coverageIndex(v, sub + v.getUint16(sub + 2), left);
  if (covIndex < 0) return null;
  const vf1 = v.getUint16(sub + 4);
  const vf2 = v.getUint16(sub + 6);
  const recordSize = 2 + valueSize(vf1) + valueSize(vf2);

  if (format === 1) {
    const pairSet = sub + v.getUint16(sub + 10 + covIndex * 2);
    let lo = 0;
    let hi = v.getUint16(pairSet) - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const rec = pairSet + 2 + mid * recordSize;
      const second = v.getUint16(rec);
      if (second === right) return xAdvance(v, rec + 2, vf1);
      if (second < right) lo = mid + 1; else hi = mid - 1;
    }
    return null;
  }
  if (format === 2) {
    const class1 = classOf(v, sub + v.getUint16(sub + 8), left);
    const class2 = classOf(v, sub + v.getUint16(sub + 10), right);
    const class1Count = v.getUint16(sub + 12);
    const class2Count = v.getUint16(sub + 14);
    if (class1 >= class1Count || class2 >= class2Count) return null;
    const rec = sub + 16 + (class1 * class2Count + class2) * (recordSize - 2);
    return xAdvance(v, rec, vf1);
  }
  return null;
}

function coverageIndex(v: DataView, cov: number, glyph: number): number {
  const format = v.getUint16(cov);
  const count = v.getUint16(cov + 2);
  let lo = 0;
  let hi = count - 1;
  if (format === 1) {
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const g = v.getUint16(cov + 4 + mid * 2);
      if (g === glyph) return mid;
      if (g < glyph) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  }
  if (format === 2) {
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const rec = cov + 4 + mid * 6;
      const start = v.getUint16(rec);
      const end = v.getUint16(rec + 2);
      if (glyph < start) hi = mid - 1;
      else if (glyph > end) lo = mid + 1;
      else return v.getUint16(rec + 4) + glyph - start;
    }
  }
  return -1;
}

function classOf(v: DataView, def: number, glyph: number): number {
  const format = v.getUint16(def);
  if (format === 1) {
    const start = v.getUint16(def + 2);
    const count = v.getUint16(def + 4);
    const i = glyph - start;
    return i >= 0 && i < count ? v.getUint16(def + 6 + i * 2) : 0;
  }
  if (format === 2) {
    let lo = 0;
    let hi = v.getUint16(def + 2) - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const rec = def + 4 + mid * 6;
      if (glyph < v.getUint16(rec)) hi = mid - 1;
      else if (glyph > v.getUint16(rec + 2)) lo = mid + 1;
      else return v.getUint16(rec + 4);
    }
  }
  return 0;
}
