/**
 * Pair kerning read straight from a font's GPOS `kern` feature.
 *
 * opentype.js reads GPOS kerning only from lookups of type 2 and skips type 9
 * (Extension), which is where a large font puts its main kerning — Inter's
 * class-based pairs all sit behind one. So the pair lookups are read here,
 * extensions unwrapped.
 *
 * Scope: horizontal pair adjustment (PairPos formats 1 and 2), first glyph's
 * XAdvance, the `kern` lookups of one LangSys in LookupList order (see
 * `lookupIndexSets`). Contextual and mark positioning are out of scope — they don't
 * change a Latin run's width.
 *
 * Self-contained on purpose: `scripts/gen-font.ts` imports it under plain
 * Node, which strips types but resolves nothing else.
 */

/** How many pairs a face remembers the kerning of before it starts over. */
const PAIR_MEMO_LIMIT = 4096;

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

  if (gpos + 10 > v.byteLength) return null;
  const featureList = gpos + v.getUint16(gpos + 6);
  const lookupList = gpos + v.getUint16(gpos + 8);
  // A list, feature, or lookup whose offsets run past the end of the font is skipped, as a subtable is below.
  const kernLookups = new Map<number, number[]>();
  const featureCount = inRange(() => v.getUint16(featureList)) ?? 0;
  for (let i = 0; i < featureCount; i++) {
    inRange(() => {
      const rec = featureList + 2 + i * 6;
      if (tag(v, rec) !== 'kern') return;
      const feature = featureList + v.getUint16(rec + 4);
      const count = v.getUint16(feature + 2);
      const indexes: number[] = [];
      for (let j = 0; j < count; j++) indexes.push(v.getUint16(feature + 4 + j * 2));
      kernLookups.set(i, indexes);
    });
  }
  if (kernLookups.size === 0) return null;

  const subtablesOf = new Map<number, number[]>();
  const lookupSets: number[][][] = [];
  for (const indexes of lookupIndexSets(v, gpos, kernLookups)) {
    const set: number[][] = [];
    for (const index of indexes) {
      if (!subtablesOf.has(index)) subtablesOf.set(index, pairSubtables(v, lookupList, index));
      const subtables = subtablesOf.get(index)!;
      if (subtables.length > 0) set.push(subtables);
    }
    if (set.length > 0) lookupSets.push(set);
  }

  const memo = new Map<number, number>();
  return (left, right) => {
    const key = left * 0x10000 + right;
    const hit = memo.get(key);
    if (hit !== undefined) return hit;
    const total = pairKerning(v, lookupSets, left, right);
    // A face lives as long as its registration, and its pairs number up to its glyph count squared.
    if (memo.size >= PAIR_MEMO_LIMIT) memo.clear();
    memo.set(key, total);
    return total;
  };
}

/**
 * The `kern` lookups each LangSys applies, one sorted set per distinct LangSys, `latn`'s first and then `DFLT`'s: a
 * shaper applies one script's lookups, so the sets are alternatives rather than a sum. A font whose ScriptList names
 * no `kern` feature has every `kern` feature's lookups taken as one set.
 */
function lookupIndexSets(v: DataView, gpos: number, kernLookups: Map<number, number[]>): number[][] {
  const scripts: { tag: string; langSyses: number[][] }[] = [];
  inRange(() => {
    const scriptOffset = v.getUint16(gpos + 4);
    if (scriptOffset === 0) return;
    const scriptList = gpos + scriptOffset;
    const count = v.getUint16(scriptList);
    for (let i = 0; i < count; i++) {
      inRange(() => {
        const rec = scriptList + 2 + i * 6;
        const script = scriptList + v.getUint16(rec + 4);
        const langSysAt: number[] = [];
        const defaultOffset = v.getUint16(script);
        if (defaultOffset !== 0) langSysAt.push(script + defaultOffset);
        const langSysCount = v.getUint16(script + 2);
        for (let j = 0; j < langSysCount; j++) langSysAt.push(script + v.getUint16(script + 4 + j * 6 + 4));
        const langSyses: number[][] = [];
        for (const at of langSysAt) {
          inRange(() => {
            const features: number[] = [];
            const required = v.getUint16(at + 2);
            if (required !== 0xffff) features.push(required);
            const featureCount = v.getUint16(at + 4);
            for (let k = 0; k < featureCount; k++) features.push(v.getUint16(at + 6 + k * 2));
            langSyses.push(features);
          });
        }
        scripts.push({ tag: tag(v, rec), langSyses });
      });
    }
  });
  const rank = (t: string): number => (t === 'latn' ? 0 : t === 'DFLT' ? 1 : 2);
  scripts.sort((a, b) => rank(a.tag) - rank(b.tag));

  const sets: number[][] = [];
  const seen = new Set<string>();
  for (const { langSyses } of scripts) {
    for (const features of langSyses) {
      const lookups = new Set<number>();
      for (const f of features) for (const l of kernLookups.get(f) ?? []) lookups.add(l);
      if (lookups.size === 0) continue;
      const set = [...lookups].sort((a, b) => a - b);
      const key = set.join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      sets.push(set);
    }
  }
  if (sets.length > 0) return sets;
  const all = new Set<number>();
  for (const indexes of kernLookups.values()) for (const l of indexes) all.add(l);
  return [[...all].sort((a, b) => a - b)];
}

/** The PairPos subtables of lookup `index`, extensions unwrapped. */
function pairSubtables(v: DataView, lookupList: number, index: number): number[] {
  const subtables: number[] = [];
  inRange(() => {
    if (index >= v.getUint16(lookupList)) return;
    const lookup = lookupList + v.getUint16(lookupList + 2 + index * 2);
    const type = v.getUint16(lookup);
    const count = v.getUint16(lookup + 4);
    for (let j = 0; j < count; j++) {
      let sub = lookup + v.getUint16(lookup + 6 + j * 2);
      let subType = type;
      // opentype.js reads no extension's header, so a font it accepts can point one past its end.
      if (type === 9) {
        if (sub + 8 > v.byteLength) continue;
        subType = v.getUint16(sub + 2);
        sub += v.getUint32(sub + 4);
      }
      if (subType === 2) subtables.push(sub);
    }
  });
  return subtables;
}

/** The pair's kerning under the first lookup set that kerns it: each of its lookups' first applying subtable, summed. */
function pairKerning(v: DataView, lookupSets: readonly (readonly number[][])[], left: number, right: number): number {
  for (const lookups of lookupSets) {
    let total = 0;
    let applied = false;
    for (const subtables of lookups) {
      for (const sub of subtables) {
        const value = readablePairValue(v, sub, left, right);
        if (value !== null) { total += value; applied = true; break; }
      }
    }
    if (applied) return total;
  }
  return 0;
}

function tag(v: DataView, at: number): string {
  return String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
}

function tableOffset(v: DataView, name: string): number | null {
  const count = v.getUint16(4);
  for (let i = 0; i < count && 12 + (i + 1) * 16 <= v.byteLength; i++) {
    const rec = 12 + i * 16;
    if (tag(v, rec) === name) return v.getUint32(rec + 8);
  }
  return null;
}

/** `read()`, or null when it reads past the end of the font. */
function inRange<T>(read: () => T): T | null {
  try {
    return read();
  } catch (err) {
    if (err instanceof RangeError) return null;
    throw err;
  }
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

/** `pairValue`, with a subtable whose offsets run past the end of the font applying to no pair. */
function readablePairValue(v: DataView, sub: number, left: number, right: number): number | null {
  return inRange(() => pairValue(v, sub, left, right));
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
    if (covIndex >= v.getUint16(sub + 8)) return null;
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
