import { describe, expect, it } from 'vitest';
import { composeOutline, inwardReach } from './composeOutline';
import { BASES, type BadgeBase } from './bases';
import { fitInsets, outlinePoints } from './bases/inscribedRect';
import type { BadgeEffectSpec } from './effects';
import type { ShapeInsets } from './types';

const FITTED = (Object.keys(BASES) as BadgeBase[]).filter((key) => BASES[key].fitsContent);

/** The insets `Badge` settles on for `content`, and the box they make: its own render loop, run to rest. */
function settle(base: BadgeBase, content: { w: number; h: number }, effects: BadgeEffectSpec[], bloat: number) {
  const mod = BASES[base];
  const params = mod.defaults;
  const declared = (typeof mod.insets === 'function' ? mod.insets(params) : mod.insets) as ShapeInsets;
  const points = outlinePoints(mod.build(params, 100, 100));
  let insets = declared;
  for (let pass = 0; pass < 12; pass++) {
    const box = { w: content.w + insets.left + insets.right, h: content.h + insets.top + insets.bottom };
    const clear = Math.ceil(inwardReach(mod.build(params, box.w, box.h), effects, bloat, box) * 2) / 2;
    const next = fitInsets(points, content, declared, clear);
    if (JSON.stringify(next) === JSON.stringify(insets)) break;
    insets = next;
  }
  const box = { w: content.w + insets.left + insets.right, h: content.h + insets.top + insets.bottom };
  return { insets, box, sampler: mod.build(params, box.w, box.h) };
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
