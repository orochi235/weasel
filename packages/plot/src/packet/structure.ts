/**
 * Edits to a packet diagram's fields as a collection, each field's bits, and its options, as plain data in and out.
 * Fields stay in bit order without overlapping: a field that grows, shrinks, comes, or goes moves every field after it.
 */
import { freshName, insertAt, moveAt, removeAt, updateAt, withOptional } from '../editing/lists';
import type { PacketData, PacketField } from './types';

const width = (f: PacketField): number => f.end - f.start + 1;

/** `fields` from index `from` on moved along by `by` bits. */
const shifted = (fields: readonly PacketField[], from: number, by: number): PacketField[] =>
  fields.map((f, i) => (i < from || by === 0 ? f : { ...f, start: f.start + by, end: f.end + by }));

/** `data` with `field` inserted before field `at`, the fields after it moved along by its width; absent, an 8-bit
 *  field just after the one before, under a fresh label. */
export function insertPacketField(data: PacketData, at: number, field?: PacketField): PacketData {
  const start = at === 0 ? 0 : (data.fields[at - 1]?.end ?? -1) + 1;
  const next = field ?? { start, end: start + 7, label: freshName('Field', data.fields.map((f) => f.label), data.fields.length + 1) };
  const room = data.fields[at] === undefined ? 0 : Math.max(0, next.end + 1 - data.fields[at]!.start);
  return { ...data, fields: insertAt(shifted(data.fields, at, room), at, next, 'insertPacketField') };
}

/** `data` without field `field`, the fields after it moved back by its width. Throws on a field it does not hold. */
export function removePacketField(data: PacketData, field: number): PacketData {
  const gone = data.fields[field];
  const fields = removeAt(data.fields, field, 'removePacketField');
  return { ...data, fields: gone === undefined ? fields : shifted(fields, field, -width(gone)) };
}

/** `data` with field `from` moved to index `to`, counted once it is taken out. Each field keeps its width and the
 *  gap before each place is kept, so the fields are laid again from the first one's start. */
export function movePacketField(data: PacketData, from: number, to: number): PacketData {
  if (from === to) return data;
  const moved = moveAt(data.fields, from, to, 'movePacketField');
  const gaps = data.fields.map((g, i) => (i === 0 ? g.start : g.start - data.fields[i - 1]!.end - 1));
  let end = -1;
  const fields = moved.map((g, i) => {
    const start = end + 1 + gaps[i]!;
    end = start + width(g) - 1;
    return { ...g, start, end };
  });
  return { ...data, fields };
}

/** `data` with field `field` `bits` wide, a whole number at least 1, the fields after it moved by the change. */
export function setPacketBits(data: PacketData, field: number, bits: number): PacketData {
  if (!Number.isInteger(bits) || bits < 1) throw new Error(`setPacketBits: a field is a whole number of bits, at least 1, and ${bits} is not`);
  const target = data.fields[field];
  if (target === undefined) throw new Error(`setPacketBits: the packet holds no field ${field}`);
  const by = bits - width(target);
  if (by === 0) return data;
  return { ...data, fields: shifted(updateAt(data.fields, field, (f) => ({ ...f, end: f.start + bits - 1 }), 'setPacketBits'), field + 1, by) };
}

/** `data` with field `field` starting at bit `start`, the fields after it moved along with it. Throws on a start
 *  inside the field before it. */
export function setPacketStart(data: PacketData, field: number, start: number): PacketData {
  const target = data.fields[field];
  if (target === undefined) throw new Error(`setPacketStart: the packet holds no field ${field}`);
  const floor = field === 0 ? 0 : data.fields[field - 1]!.end + 1;
  if (!Number.isInteger(start) || start < floor) throw new Error(`setPacketStart: field ${field} starts at bit ${floor} or later, and ${start} is earlier`);
  return { ...data, fields: shifted(data.fields, field, start - target.start) };
}

/** `data` with field `field` written as a count of bits after the field before (`+8`), or as a range. */
export const setPacketRelative = (data: PacketData, field: number, relative: boolean): PacketData => {
  const fields = updateAt(data.fields, field, (f) => ((f.relative ?? false) === relative ? f : withOptional(f, 'relative', relative ? true : undefined)), 'setPacketRelative');
  return fields[field] === data.fields[field] ? data : { ...data, fields };
};

/** `data` with `bits` to a row; `undefined` for the default 32. */
export function setPacketBitsPerRow(data: PacketData, bits: number | undefined): PacketData {
  if (bits !== undefined && (!Number.isInteger(bits) || bits < 1)) throw new Error(`setPacketBitsPerRow: a row is a whole number of bits, at least 1, and ${bits} is not`);
  return data.bitsPerRow === bits ? data : withOptional(data, 'bitsPerRow', bits);
}
