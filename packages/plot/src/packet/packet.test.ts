import { describe, expect, it } from 'vitest';
import { PLOT_THEME, seriesColor } from '../theme';
import { compilePacket, packetPieces } from './compile';
import { setPacketLabel } from './edit';
import { packetEditor } from './editor';
import type { PacketData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const SIZE = { width: 800, height: 400 };

const UDP: PacketData = {
  kind: 'packet',
  title: 'UDP',
  fields: [
    { start: 0, end: 15, label: 'Source Port' },
    { start: 16, end: 31, label: 'Destination Port' },
    { start: 32, end: 47, label: 'Length' },
    { start: 52, end: 52, label: 'Flag' },
    { start: 56, end: 103, label: 'Data' },
  ],
};

const byKey = (data: PacketData) => {
  const { marks, layout } = compilePacket(data, SIZE, PLOT_THEME, measure);
  return { layout, marks, get: (key: string) => marks.find((m) => m.key === key) };
};

describe('compilePacket', () => {
  it('cuts a field where it wraps, one piece per row', () => {
    expect(packetPieces({ start: 56, end: 103, label: '' }, 32)).toEqual([{ row: 1, lo: 56, hi: 63 }, { row: 2, lo: 64, hi: 95 }, { row: 3, lo: 96, hi: 103 }]);
    expect(packetPieces({ start: 5, end: 2, label: '' }, 32)).toEqual([]);
  });

  it('draws a box per row a field covers, along the bits of the row', () => {
    const { layout, get } = byKey(UDP);
    expect(layout.rows).toBe(4);
    const src = get('field:0:0')!;
    expect(src.pose.x).toBeCloseTo(layout.bits.start('0'));
    expect(src.pose.x + src.pose.width).toBeCloseTo(layout.bits.start('15') + layout.bits.bandwidth);
    expect(src.pose.y).toBeCloseTo(layout.boxTop(0));
    expect(src.data.plotMark).toEqual({ kind: 'span', datum: { field: 0 } });
    expect(src.data.fill?.paint.color).toBe(seriesColor(PLOT_THEME, 0));
    expect(get('field:4:1')!.pose.x).toBeCloseTo(layout.bits.start('24'));
    expect(get('field:4:2')!.pose.width).toBeCloseTo(layout.bits.bandwidth * 32);
    expect(get('field:4:3')!.pose.y).toBeCloseTo(layout.boxTop(3));
    expect(get('field:4:0')).toBeUndefined();
  });

  it('labels each field in its widest piece', () => {
    const { layout, get } = byKey(UDP);
    const label = get('field:label:4')!;
    expect(label.data.text).toBe('Data');
    expect(label.data.plotMark.datum).toEqual({ edit: 'label', field: 4 });
    expect(label.pose.y + label.pose.height / 2).toBeCloseTo(layout.boxTop(2) + layout.boxHeight / 2);
  });

  it('numbers each piece\'s first and last bit above it, and a one-bit field once', () => {
    const { layout, get } = byKey(UDP);
    expect(get('bit:1:0:start')!.data.text).toBe('16');
    expect(get('bit:1:0:end')!.data.text).toBe('31');
    expect(get('bit:1:0:end')!.pose.y + 14).toBeLessThanOrEqual(layout.boxTop(0));
    expect(get('bit:4:2:start')!.data.text).toBe('64');
    expect(get('bit:3:1:start')!.data.text).toBe('52');
    expect(get('bit:3:1:end')).toBeUndefined();
  });

  it('lays rows of its own width, and draws nothing for no fields or a tiny box', () => {
    const { layout } = byKey({ ...UDP, bitsPerRow: 16 });
    expect(layout.rows).toBe(7);
    expect(compilePacket({ kind: 'packet', fields: [] }, SIZE, PLOT_THEME, measure).marks).toEqual([]);
    expect(() => compilePacket(UDP, { width: 2, height: 2 }, PLOT_THEME, measure)).not.toThrow();
  });
});

describe('packet edits', () => {
  it('setPacketLabel relabels one field', () => {
    const next = setPacketLabel(UDP, 2, 'Len');
    expect(next.fields[2]).toEqual({ start: 32, end: 47, label: 'Len' });
    expect(next.fields[0]).toBe(UDP.fields[0]);
    expect(setPacketLabel(UDP, 2, 'Length')).toBe(UDP);
    expect(() => setPacketLabel(UDP, 9, 'x')).toThrow(/no field 9/);
  });

  it('the editor takes no drag, and sets the title and a label typed in place', () => {
    const { get } = byKey(UDP);
    const box = get('field:0:0')!;
    expect(packetEditor.handle(UDP, { trait: box.data.plotMark, pose: box.pose })).toBeNull();
    expect(packetEditor.text!(UDP, { edit: 'title' }, 'TCP').title).toBe('TCP');
    expect(packetEditor.text!(UDP, { edit: 'label', field: 1 }, ' Dest ').fields[1]!.label).toBe('Dest');
    expect(packetEditor.text!(UDP, { edit: 'label', field: 1 }, '')).toBe(UDP);
    expect(packetEditor.text!(UDP, { edit: 'label', field: 8 }, 'x')).toBe(UDP);
  });
});
