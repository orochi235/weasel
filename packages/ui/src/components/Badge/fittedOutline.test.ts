import { describe, expect, it } from 'vitest';
import { composeOutline } from './composeOutline';
import { BASES, type BadgeBase } from './bases';
import { outlinePoints } from './bases/inscribedRect';
import { fitMoved } from './useInsets';
import type { BadgeEffectSpec } from './effects';
import type { ShapeInsets } from './types';

const FITTED = (Object.keys(BASES) as BadgeBase[]).filter((key) => BASES[key].fitsContent);

/** The insets `Badge` fits around `content`, and the box they make. */
function settle(base: BadgeBase, content: { w: number; h: number }, effects: BadgeEffectSpec[], bloat: number) {
  const mod = BASES[base];
  const params = mod.defaults;
  const declared = (typeof mod.insets === 'function' ? mod.insets(params) : mod.insets) as ShapeInsets;
  const build = (w: number, h: number) => mod.build(params, w, h);
  const insets = fitMoved(build, outlinePoints(build(100, 100)), content, declared, { effects, bloat });
  const box = { w: content.w + insets.left + insets.right, h: content.h + insets.top + insets.bottom };
  return { insets, box, sampler: build(box.w, box.h) };
}

/** How many CSS px the deepest point of the composed outline sits inside the content. */
function deepestInside(base: BadgeBase, content: { w: number; h: number }, effects: BadgeEffectSpec[], bloat = 0): number {
  const { insets, box, sampler } = settle(base, content, effects, bloat);
  const outline = composeOutline(sampler, effects, bloat, box, 0);
  let worst = 0;
  for (let i = 0; i < 4000; i++) {
    const p = outline.perimeterAt((i / 4000) * outline.totalCss);
    const x = (p.x / 100) * box.w - insets.left;
    const y = (p.y / 100) * box.h - insets.top;
    worst = Math.max(worst, Math.min(x, content.w - x, y, content.h - y));
  }
  return worst;
}

describe('a fitted base keeps its content inside the composed outline', () => {
  const EFFECTS: Record<string, BadgeEffectSpec[]> = {
    scallops: [{ type: 'scallops', params: { scallopRadius: 5, scallopSpacing: 12 } }],
    bites: [{ type: 'bites', params: { biteRadius: 4, biteSpacing: 12 } }],
    spikes: [{ type: 'spikes' }],
  };
  for (const base of FITTED) {
    for (const [name, effects] of Object.entries(EFFECTS)) {
      for (const w of [60, 170]) {
        it(`${base}, ${name}, content ${w} wide`, () => {
          expect(deepestInside(base, { w, h: 16 }, effects)).toBeLessThan(0.3);
        }, 20_000);
      }
    }
  }
});

describe('a fitted base under an outward bloat', () => {
  for (const base of FITTED) {
    it(`${base} keeps its content inside the outline`, () => {
      expect(deepestInside(base, { w: 170, h: 16 }, [], 3)).toBeLessThan(0.3);
    });
  }

  // Each point beside a quatrefoil's valley crosses it and lands inside the base, beyond the content.
  it('pads no further where the outline crosses a notch off the content', () => {
    for (const w of [60, 170]) {
      expect(settle('quatrefoil', { w, h: 16 }, [], 3).insets).toEqual(settle('quatrefoil', { w, h: 16 }, [], 0).insets);
    }
  });

  it('pads further where it crosses one onto the content', () => {
    expect(settle('octant-bspline', { w: 170, h: 16 }, [], 3).insets.top).toBeGreaterThan(settle('octant-bspline', { w: 170, h: 16 }, [], 0).insets.top);
  });
});
