/**
 * A structural check of a font's `CFF ` table, run before opentype.js reads it.
 *
 * opentype.js trusts the table: a top DICT operator given the wrong number of operands hands it an array where it
 * expects an offset, which it adds to a number as a string, and an INDEX at that "offset" then reads byte 0 tens of
 * thousands of times while the string grows. A 2.6 KB face held the parser for a minute. So every INDEX and DICT
 * opentype.js follows from the header is checked here first: inside the table, offsets in order, and each offset
 * operator holding the one integer (two, for `Private`) the format gives it.
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
/** Private DICT `Subrs`, an offset from the Private DICT's start. */
const SUBRS = 19;
/** `charset` and `Encoding` values below these name a predefined set, not an offset. */
const PREDEFINED: Record<number, number> = { 15: 3, 16: 2 };

const bad = (what: string): Error => new Error(`the font's CFF table is damaged: ${what}`);

/** Throws unless the CFF table `cff` (the table's bytes alone) can be read without leaving it. CFF2 passes unread. */
export function checkCff(cff: DataView): void {
  if (cff.byteLength < 4) throw bad('its header is cut off');
  if (cff.getUint8(0) !== 1) return;
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
    if (op in PREDEFINED && operands[0]! < PREDEFINED[op]!) continue;
    if (op === 18) checkPrivate(cff, operands[1]!, operands[0]!);
    else if (operands[0]! < 0 || operands[0]! >= cff.byteLength) throw bad(`Top DICT operator ${op} points past the table`);
    if (op === 17 || op === 1236) readIndex(cff, operands[0]!, op === 17 ? 'CharStrings INDEX' : 'FDArray INDEX');
  }
  if (!top.has(17)) throw bad('it has no CharStrings');
}

function checkPrivate(cff: DataView, at: number, size: number): void {
  if (at < 0 || size < 0 || at + size > cff.byteLength) throw bad('its Private DICT runs past the table');
  const subrs = readDict(cff, [at, at + size], 'Private DICT').get(SUBRS);
  if (subrs === undefined) return;
  if (subrs.length !== 1 || !Number.isInteger(subrs[0])) throw bad(`Private DICT Subrs holds ${subrs.join(' ')}`);
  readIndex(cff, at + subrs[0]!, 'Local Subr INDEX');
}

/** An INDEX at `at`: each item's `[start, end)`, and where the INDEX ends. */
function readIndex(cff: DataView, at: number, what: string): { items: [number, number][]; end: number } {
  const past = () => bad(`its ${what} runs past the table`);
  if (at < 0 || at + 2 > cff.byteLength) throw past();
  const count = cff.getUint16(at);
  if (count === 0) return { items: [], end: at + 2 };
  if (at + 3 > cff.byteLength) throw past();
  const size = cff.getUint8(at + 2);
  if (size < 1 || size > 4) throw bad(`its ${what} has offsets ${size} bytes wide`);
  const offsetsAt = at + 3;
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

/** A DICT's operators, each with its operands; a two-byte operator `12 n` is keyed `1200 + n`. */
function readDict(cff: DataView, [start, end]: [number, number], what: string): Map<number, number[]> {
  const out = new Map<number, number[]>();
  let operands: number[] = [];
  let at = start;
  const byte = (): number => {
    if (at >= end) throw bad(`its ${what} is cut off inside an operand`);
    return cff.getUint8(at++);
  };
  while (at < end) {
    const b0 = byte();
    if (b0 <= 21) {
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
