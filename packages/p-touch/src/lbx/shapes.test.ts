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
