import type { DrawCommand } from '@weasel-js/core/renderer';
import { combTeeth, type View } from '@weasel-js/geom';
import { CURVE_REPS, curvatureSourceOf, type SharedAnchor } from '@weasel-js/geom/curves';
import { describe, expect, it } from 'vitest';
import { createCurvatureCombLayer } from '../curveLab/overlays';

const VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const S_CURVE: SharedAnchor[] = [
  { x: 0, y: 0 }, { x: 80, y: -60 }, { x: 160, y: 40 }, { x: 240, y: -20 },
];

describe('curve lab curvature comb', () => {
  it.each(Object.values(CURVE_REPS))('draws the engine comb\'s teeth for $kind', (rep) => {
    const layer = createCurvatureCombLayer(rep, () => S_CURVE, 600);
    const lines = (layer.draw(undefined, VIEW, { width: 400, height: 400, dpr: 1 }) as DrawCommand[])
      .flatMap((cmd) => (cmd.kind === 'path' && cmd.path.kind === 'polygon' && cmd.path.coords.length === 4
        ? [cmd.path.coords] : []));
    const teeth = combTeeth(curvatureSourceOf(rep, S_CURVE), { scale: 600, samplesPerSegment: 65 });
    expect(lines).toHaveLength(teeth.length);
    teeth.forEach((tooth, i) => {
      const [x0, y0, x1, y1] = lines[i];
      expect(x0).toBeCloseTo(tooth.x, 2);
      expect(y0).toBeCloseTo(tooth.y, 2);
      expect(x1).toBeCloseTo(tooth.tipX, 2);
      expect(y1).toBeCloseTo(tooth.tipY, 2);
    });
  });
});
