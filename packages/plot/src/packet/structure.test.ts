import { describe, expect, it } from 'vitest';
import { compilePlot } from '../plotData';
import { PLOT_THEME } from '../theme';
import {
  insertPacketField, movePacketField, removePacketField, setPacketBits, setPacketBitsPerRow, setPacketRelative, setPacketStart,
} from './structure';
import type { PacketData } from './types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const compiles = (d: PacketData) => expect(compilePlot(d, { width: 600, height: 400 }, PLOT_THEME, measure).length).toBeGreaterThan(0);
const bits = (d: PacketData) => d.fields.map((f) => `${f.label}:${f.start}-${f.end}`);

const P: PacketData = { kind: 'packet', fields: [{ start: 0, end: 7, label: 'a' }, { start: 8, end: 15, label: 'b' }, { start: 20, end: 23, label: 'c' }] };

describe('packet structure', () => {
  it('builds a packet from nothing, each field just after the one before', () => {
    let d = insertPacketField({ kind: 'packet', fields: [] }, 0);
    d = insertPacketField(d, 1);
    expect(bits(d)).toEqual(['Field 1:0-7', 'Field 2:8-15']);
    compiles(d);
  });

  it('moves the fields after an inserted or removed one by its width', () => {
    expect(bits(insertPacketField(P, 1))).toEqual(['a:0-7', 'Field 4:8-15', 'b:16-23', 'c:28-31']);
    expect(bits(removePacketField(P, 0))).toEqual(['b:0-7', 'c:12-15']);
  });

  it('lays fields again in their new order, each keeping its width, each place its gap', () => {
    expect(bits(movePacketField(P, 2, 0))).toEqual(['c:0-3', 'a:4-11', 'b:16-23']);
    expect(() => movePacketField(P, 0, 3)).toThrow(/cannot move to 3/);
  });

  it('grows, shrinks and moves a field, pushing those after it', () => {
    expect(bits(setPacketBits(P, 0, 4))).toEqual(['a:0-3', 'b:4-11', 'c:16-19']);
    expect(bits(setPacketStart(P, 1, 10))).toEqual(['a:0-7', 'b:10-17', 'c:22-25']);
    expect(() => setPacketStart(P, 1, 7)).toThrow(/bit 8 or later/);
    expect(() => setPacketBits(P, 0, 0)).toThrow(/at least 1/);
  });

  it('sets how a field is written and the row width', () => {
    expect(setPacketRelative(P, 1, true).fields[1]).toEqual({ start: 8, end: 15, label: 'b', relative: true });
    expect(setPacketRelative(setPacketRelative(P, 1, true), 1, false)).toEqual(P);
    expect(setPacketBitsPerRow(setPacketBitsPerRow(P, 16), undefined)).toEqual(P);
    expect(() => setPacketBitsPerRow(P, 0)).toThrow(/at least 1/);
    compiles(setPacketBitsPerRow(P, 16));
  });
});
