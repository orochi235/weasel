/** A packet diagram as its options and one table of fields, each laid after the one before. */
import { integerOf, titleField } from '../editing/schemaKit';
import type { PlotSchema } from '../editing/schemaTypes';
import { PACKET_MAX_BIT, PACKET_MAX_BITS_PER_ROW } from './compile';
import { setPacketLabel } from './edit';
import {
  insertPacketField, movePacketField, removePacketField, setPacketBits, setPacketBitsPerRow, setPacketRelative, setPacketStart,
} from './structure';
import type { PacketData } from './types';

export const packetSchema: PlotSchema<PacketData> = {
  fields: [
    titleField(),
    {
      key: 'bitsPerRow', label: 'Bits per row', type: { kind: 'number', min: 1, max: PACKET_MAX_BITS_PER_ROW, step: 1 }, optional: true,
      get: (d) => d.bitsPerRow,
      set: (d, v) => {
        const n = integerOf(v);
        return v === undefined || (n !== undefined && n >= 1) ? setPacketBitsPerRow(d, n === undefined ? n : Math.min(n, PACKET_MAX_BITS_PER_ROW)) : d;
      },
    },
  ],
  tables: [{
    key: 'fields', label: 'Fields', item: 'field',
    count: (d) => d.fields.length,
    columns: () => [
      {
        key: 'label', label: 'Label', type: { kind: 'string' },
        get: (d, _, r) => d.fields[r]?.label,
        set: (d, _, r, v) => (typeof v === 'string' ? setPacketLabel(d, r, v.trim()) : d),
      },
      {
        key: 'start', label: 'Start', type: { kind: 'number', min: 0, max: PACKET_MAX_BIT, step: 1 },
        get: (d, _, r) => d.fields[r]?.start,
        set: (d, _, r, v) => {
          const n = integerOf(v);
          const floor = r === 0 ? 0 : (d.fields[r - 1]?.end ?? -1) + 1;
          return n !== undefined && n >= floor ? setPacketStart(d, r, Math.max(floor, Math.min(n, PACKET_MAX_BIT))) : d;
        },
      },
      {
        key: 'bits', label: 'Bits', type: { kind: 'number', min: 1, max: PACKET_MAX_BIT + 1, step: 1 },
        get: (d, _, r) => { const f = d.fields[r]; return f && f.end - f.start + 1; },
        set: (d, _, r, v) => {
          const n = integerOf(v);
          return n !== undefined && n >= 1 ? setPacketBits(d, r, Math.min(n, PACKET_MAX_BIT + 1)) : d;
        },
      },
      {
        key: 'end', label: 'End', type: { kind: 'number' }, readOnly: true,
        get: (d, _, r) => d.fields[r]?.end,
        set: (d) => d,
      },
      {
        key: 'relative', label: 'Relative', type: { kind: 'boolean' },
        get: (d, _, r) => d.fields[r]?.relative ?? false,
        set: (d, _, r, v) => (typeof v === 'boolean' ? setPacketRelative(d, r, v) : d),
      },
    ],
    insert: (d, _, at) => insertPacketField(d, at),
    remove: (d, _, r) => removePacketField(d, r),
    move: (d, _, from, to) => movePacketField(d, from, to),
    rowLabel: (d, _, r) => d.fields[r]?.label ?? '',
  }],
};
