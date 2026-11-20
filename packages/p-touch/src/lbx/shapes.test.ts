import { describe, expect, it } from 'vitest';
import { PathBuilder } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import { tapeForWidthMm } from '../tape';
import { lbxConfig } from './writeLbx';

const tape = tapeForWidthMm(12)!;
const types = async (commands: DrawCommand[]) =>
  (await lbxConfig({ length: 144, tape, commands })).config.objects.map((o) => o.type);

describe('stroke joins', () => {
  const rect = (miterLimit?: number): DrawCommand => ({
    kind: 'path', path: { kind: 'rect', x: 10, y: 5, width: 40, height: 20 },
    stroke: { paint: { color: '#000' }, width: 2, join: 'miter', miterLimit },
  });

  it('rasterizes a rect whose miter limit bevels its corners', async () => {
    expect(await types([rect(1)])).toEqual([]);
    expect(await types([rect(1.5)])).toEqual(['rect']);
    expect(await types([rect()])).toEqual(['rect']);
  });
});

describe('polylines', () => {
  const line = (points: [number, number][], stroke: Record<string, unknown> = {}): DrawCommand => {
    const b = new PathBuilder().moveTo(...points[0]!);
    for (const p of points.slice(1)) b.lineTo(...p);
    return { kind: 'path', path: b.build(), stroke: { paint: { color: '#000' }, width: 1, ...stroke } };
  };
  const corner: [number, number][] = [[0, 0], [30, 10], [60, 0]];

  it('rasterizes a polyline whose corners are rounded, beveled, or past the miter limit', async () => {
    expect(await types([line(corner)])).toEqual(['line']);
    expect(await types([line(corner, { join: 'round' })])).toEqual([]);
    expect(await types([line(corner, { join: 'bevel' })])).toEqual([]);
    expect(await types([line([[0, 0], [5, 40], [10, 0]])])).toEqual([]);
    expect(await types([line([[0, 0], [60, 0]], { join: 'round' })])).toEqual(['line']);
  });
});
