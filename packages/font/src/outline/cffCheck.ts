/**
 * A structural check of a font's `CFF ` table, run before opentype.js reads it.
 *
 * opentype.js trusts the table: a top DICT operator given the wrong number of operands hands it an array where it
 * expects an offset, which it adds to a number as a string, and an INDEX at that "offset" then reads byte 0 tens of
 * thousands of times while the string grows. A 2.6 KB face held the parser for a minute. So every INDEX and DICT
 * opentype.js follows from the header, the FDArray's Font DICTs included, is checked here first: inside the table,
 * offsets in order, and each offset operator holding the one integer (two, for `Private`) the format gives it.
 */

/** Top DICT operators whose operands opentype.js reads as offsets, with how many each takes. */
const TOP_OFFSETS = new Map<number, number>([
  [15, 1], // charset
  [16, 1], // Encoding
  [17, 1], // CharStrings
  [18, 2], // Private: size, offset
  [1236, 1], // FDArray (12 36)
  [1237, 1], // FDSelect (12 37)
]);
/** CFF2 Top DICT operators, each an offset holding one integer: CharStrings, FDArray, FDSelect, and vstore. */
const CFF2_TOP_OFFSETS = [17, 1236, 1237, 24] as const;
/** Private DICT `Subrs`, an offset from the Private DICT's start. */
const SUBRS = 19;
/** `charset` and `Encoding` values below these name a predefined set, not an offset. */
/** The CFF2 DICT operator `blend`. */
const BLEND = 23;
const PREDEFINED: Record<number, number> = { 15: 3, 16: 2 };

const bad = (what: string): Error => new Error(`the font's CFF table is damaged: ${what}`);

/** Throws unless the CFF table `cff` (the table's bytes alone) can be read without leaving it, by the version its
 *  header names; one whose header names neither 1 nor 2 is refused. */
export function checkCff(cff: DataView): void {
  if (cff.byteLength < 4) throw bad('its header is cut off');
  const major = cff.getUint8(0);
  if (major === 2) return checkCff2(cff);
  // opentype.js reads every major version below 2 as CFF 1, so a 0 would pass unchecked.
  if (major !== 1) throw bad(`its header names version ${major}`);
  const names = readIndex(cff, cff.getUint8(2), 'Name INDEX');
  const tops = readIndex(cff, names.end, 'Top DICT INDEX');
  const strings = readIndex(cff, tops.end, 'String INDEX');
  readIndex(cff, strings.end, 'Global Subr INDEX');
  if (tops.items.length !== 1) throw bad(`it holds ${tops.items.length} fonts`);
  const top = readDict(cff, tops.items[0]!, 'Top DICT');
  for (const [op, count] of TOP_OFFSETS) {
    const operands = top.get(op);
    if (operands === undefined) continue;
    if (operands.length !== count || !operands.every(Number.isInteger)) throw bad(`Top DICT operator ${op} holds ${operands.join(' ')}`);
    if (Object.hasOwn(PREDEFINED, op) && operands[0]! < PREDEFINED[op]!) continue;
    if (op === 18) checkPrivate(cff, operands[1]!, operands[0]!);
    else if (operands[0]! < 0 || operands[0]! >= cff.byteLength) throw bad(`Top DICT operator ${op} points past the table`);
    if (op === 17) readIndex(cff, operands[0]!, 'CharStrings INDEX');
    // opentype.js reads each FDArray item as it reads the Top DICT, following its Private and Subrs.
    if (op === 1236) for (const item of readIndex(cff, operands[0]!, 'FDArray INDEX').items) checkFontDict(cff, item);
  }
  if (!top.has(17)) throw bad('it has no CharStrings');
}

/** CFF2 (`version` 2): a Top DICT the header sizes, then the Global Subr INDEX, with INDEX counts four bytes wide. */
function checkCff2(cff: DataView): void {
  if (cff.byteLength < 5) throw bad('its header is cut off');
  const headerSize = cff.getUint8(2);
  const topEnd = headerSize + cff.getUint16(3);
  if (headerSize < 5 || topEnd > cff.byteLength) throw bad('its Top DICT runs past the table');
  readIndex(cff, topEnd, 'Global Subr INDEX', 2);
  const top = readDict(cff, [headerSize, topEnd], 'Top DICT', 2);
  for (const op of CFF2_TOP_OFFSETS) {
    const operands = top.get(op);
    if (operands === undefined) continue;
    if (operands.length !== 1 || !Number.isInteger(operands[0])) throw bad(`Top DICT operator ${op} holds ${operands.join(' ')}`);
    if (operands[0]! < 0 || operands[0]! >= cff.byteLength) throw bad(`Top DICT operator ${op} points past the table`);
    if (op === 17) readIndex(cff, operands[0]!, 'CharStrings INDEX', 2);
    if (op === 1236) for (const item of readIndex(cff, operands[0]!, 'FDArray INDEX', 2).items) checkFontDict(cff, item, 2);
  }
  if (!top.has(17)) throw bad('it has no CharStrings');
  if (!top.has(1236)) throw bad('it has no FDArray');
}

function checkFontDict(cff: DataView, item: [number, number], version: 1 | 2 = 1): void {
  const operands = readDict(cff, item, 'FDArray Font DICT', version).get(18);
  if (operands === undefined) return;
  if (operands.length !== 2 || !operands.every(Number.isInteger)) throw bad(`Font DICT operator 18 holds ${operands.join(' ')}`);
  checkPrivate(cff, operands[1]!, operands[0]!, version);
}

function checkPrivate(cff: DataView, at: number, size: number, version: 1 | 2 = 1): void {
  if (at < 0 || size < 0 || at + size > cff.byteLength) throw bad('its Private DICT runs past the table');
  const subrs = readDict(cff, [at, at + size], 'Private DICT', version).get(SUBRS);
  if (subrs === undefined) return;
  if (subrs.length !== 1 || !Number.isInteger(subrs[0])) throw bad(`Private DICT Subrs holds ${subrs.join(' ')}`);
  readIndex(cff, at + subrs[0]!, 'Local Subr INDEX', version);
}

/** An INDEX at `at`: each item's `[start, end)`, and where the INDEX ends. A CFF2 INDEX counts in four bytes. */
function readIndex(cff: DataView, at: number, what: string, version: 1 | 2 = 1): { items: [number, number][]; end: number } {
  const past = () => bad(`its ${what} runs past the table`);
  const countBytes = version === 2 ? 4 : 2;
  if (at < 0 || at + countBytes > cff.byteLength) throw past();
  const count = version === 2 ? cff.getUint32(at) : cff.getUint16(at);
  if (count === 0) return { items: [], end: at + countBytes };
  if (at + countBytes + 1 > cff.byteLength) throw past();
  const size = cff.getUint8(at + countBytes);
  if (size < 1 || size > 4) throw bad(`its ${what} has offsets ${size} bytes wide`);
  const offsetsAt = at + countBytes + 1;
  const base = offsetsAt + (count + 1) * size - 1;
  if (base + 1 > cff.byteLength) throw past();
  const offset = (i: number): number => {
    let v = 0;
    for (let b = 0; b < size; b++) v = v * 256 + cff.getUint8(offsetsAt + i * size + b);
    return v;
  };
  const items: [number, number][] = [];
  let prev = offset(0);
  if (prev !== 1) throw bad(`its ${what} starts at offset ${prev}`);
  for (let i = 1; i <= count; i++) {
    const next = offset(i);
    if (next < prev || base + next > cff.byteLength) throw past();
    items.push([base + prev, base + next]);
    prev = next;
  }
  return { items, end: base + prev };
}

/** A DICT's operators, each with its operands; a two-byte operator `12 n` is keyed `1200 + n`. CFF2 adds operators up
 *  to 27, among them `blend`, which keeps the first of its operands as many as its last one names, as opentype.js does. */
function readDict(cff: DataView, [start, end]: [number, number], what: string, version: 1 | 2 = 1): Map<number, number[]> {
  const out = new Map<number, number[]>();
  let operands: number[] = [];
  let at = start;
  const byte = (): number => {
    if (at >= end) throw bad(`its ${what} is cut off inside an operand`);
    return cff.getUint8(at++);
  };
  while (at < end) {
    const b0 = byte();
    if (version === 2 && b0 === BLEND) {
      const kept = operands.pop();
      if (kept !== undefined && operands.length > kept) operands.length = Math.max(0, Math.floor(kept));
    } else if (b0 <= (version === 2 ? 27 : 21)) {
      out.set(b0 === 12 ? 1200 + byte() : b0, operands);
      operands = [];
    } else if (b0 === 28) operands.push(((byte() << 8) | byte()) << 16 >> 16);
    else if (b0 === 29) operands.push((byte() << 24) | (byte() << 16) | (byte() << 8) | byte());
    else if (b0 === 30) {
      for (let n = byte(); (n & 0x0f) !== 0x0f && (n >> 4) !== 0x0f; n = byte());
      // A real is never an offset; any fraction stands in for it.
      operands.push(0.5);
    } else if (b0 >= 32 && b0 <= 246) operands.push(b0 - 139);
    else if (b0 >= 247 && b0 <= 250) operands.push((b0 - 247) * 256 + byte() + 108);
    else if (b0 >= 251 && b0 <= 254) operands.push(-(b0 - 251) * 256 - byte() - 108);
    else throw bad(`its ${what} holds the reserved byte ${b0}`);
  }
  return out;
}
