import { describe, expect, it } from 'vitest';
import { nurbs } from '@weasel-js/geom/curves';
import { CURVE_PRESETS } from '../curveLab/presets';

describe('curve lab presets', () => {
  it('promises an exact circle only where the NURBS panel draws one', () => {
    const preset = CURVE_PRESETS.find((p) => p.id === 'near-circle')!;
    const radii = Array.from({ length: 33 }, (_, i) => {
      const p = nurbs.evaluate(preset.anchors, i / 32);
      return Math.hypot(p.x - 200, p.y - 200);
    });
    const round = Math.max(...radii) - Math.min(...radii) < 1e-6;
    expect(/exact circle/i.test(preset.description)).toBe(round);
  });
});
