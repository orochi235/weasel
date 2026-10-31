/** Edits to a packet diagram, as plain data in and out. */
import type { PacketData } from './types';

/** `data` with field `field` labeled `label`. Throws on a field the packet does not hold. */
export function setPacketLabel(data: PacketData, field: number, label: string): PacketData {
  const target = data.fields[field];
  if (target === undefined) throw new Error(`setPacketLabel: the packet holds no field ${field}`);
  if (target.label === label) return data;
  return { ...data, fields: data.fields.map((f, i) => (i === field ? { ...f, label } : f)) };
}
