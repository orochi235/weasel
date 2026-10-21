import type { GlMat3 } from '@weasel-js/geom';
import { describe, expect, it } from 'vitest';
import type { StrokedPathCommand } from './strokeLengths';
import { resolveStrokeLengths } from './strokeLengths';

const scale075: GlMat3 = Float64Array.from([0.75, 0, 0, 0, 0.75, 0, 0, 0, 1]);
const cmd: StrokedPathCommand = {
  kind: 'path',
  path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 },
  stroke: { paint: { color: '#000' }, width: { px: 2 }, dash: [3, 3] },
};

describe('resolveStrokeLengths', () => {
  it('snaps a { px } width to the quantized scale by default', () => {
    expect(resolveStrokeLengths(scale075, cmd).cmd.stroke.width).not.toBe(2 / 0.75);
  });

  it('resolves against the exact scale with quantize: false', () => {
    const { stroke } = resolveStrokeLengths(scale075, cmd, { quantize: false }).cmd;
    expect(stroke.width).toBeCloseTo(2 / 0.75, 12);
    expect(stroke.dash?.[0]).toBeCloseTo(3 / 0.75, 12);
  });
});
