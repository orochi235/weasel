/**
 * Datafork TrueType (`.dfont`): a Macintosh resource fork written to a file's
 * data fork, holding each face as one whole sfnt in an `sfnt` resource.
 *
 * The fork is a data segment and a map. The map's type list names each
 * resource type and points at its reference list; a reference gives a
 * resource's offset into the data segment, where a length precedes its bytes.
 */

import { tagAt } from './tag';

const RESOURCE_HEADER_BYTES = 16;
const TYPE_ENTRY_BYTES = 8;
const REFERENCE_BYTES = 12;

/** Every signature that opens a font file this tier can hand to a parser. */
const FONT_SIGNATURES: ReadonlySet<string> = new Set([
  '\x00\x01\x00\x00', 'true', 'typ1', 'OTTO', 'ttcf', 'wOFF', 'wOF2',
]);

/**
 * Is `bytes` a Datafork TrueType file (`.dfont`)?
 *
 * Unlike every other font format it opens with no signature — just the
 * resource header's four big-endian offsets. It is recognized by those
 * adding up, which is why the signature check has to run first: an sfnt's
 * header bytes are numbers too, and nothing stops them from coincidentally
 * being consistent.
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

const truncated = (): Error =>
  new Error('Datafork TrueType (.dfont) is truncated: a resource runs past the end of its segment.');

/**
 * Each `sfnt` resource of a `.dfont`, in map order, as standalone font bytes.
 * Empty when the fork holds none.
 */
export function sfntResources(bytes: ArrayBuffer): ArrayBuffer[] {
  const view = new DataView(bytes);
  const dataOffset = view.getUint32(0);
  const mapOffset = view.getUint32(4);
  const dataLength = view.getUint32(8);
  const mapEnd = mapOffset + view.getUint32(12);
  /** `count` bytes at `at` lie inside the map. */
  const inMap = (at: number, count: number): boolean => at >= mapOffset && at + count <= mapEnd;

  if (!inMap(mapOffset + 24, 2)) return [];
  const typeList = mapOffset + view.getUint16(mapOffset + 24);
  if (!inMap(typeList, 2)) return [];
  // Counts are stored less one, so an empty list reads as 0xffff.
  const typeCount = (view.getUint16(typeList) + 1) & 0xffff;

  const out: ArrayBuffer[] = [];
  for (let t = 0; t < typeCount; t++) {
    const entry = typeList + 2 + t * TYPE_ENTRY_BYTES;
    if (!inMap(entry, TYPE_ENTRY_BYTES)) throw truncated();
    if (tagAt(view, entry) !== 'sfnt') continue;
    const count = view.getUint16(entry + 4) + 1;
    const references = typeList + view.getUint16(entry + 6);
    for (let i = 0; i < count; i++) {
      const ref = references + i * REFERENCE_BYTES;
      if (!inMap(ref, REFERENCE_BYTES)) throw truncated();
      // A three-byte offset, behind the one-byte attributes it shares a word with.
      const offset = view.getUint32(ref + 4) & 0xffffff;
      if (offset + 4 > dataLength) throw truncated();
      const start = dataOffset + offset + 4;
      const length = view.getUint32(start - 4);
      if (offset + 4 + length > dataLength) throw truncated();
      out.push(bytes.slice(start, start + length));
    }
  }
  return out;
}
