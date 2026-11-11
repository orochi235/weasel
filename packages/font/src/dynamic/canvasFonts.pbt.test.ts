/**
 * Stateful test of canvas-family enrollment: explicit registrations, the `'canvas'` policy's auto-enrollments,
 * unregistrations, and policy changes, against a model of the two kinds of enrollment. Every step checks
 * `isCanvasFont`, `isExplicitCanvasFont`, `listCanvasFonts`, and that a face lives until its family is unregistered.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { _resetFallbackForTests, setFontFallbackPolicy, type FontFallbackPolicy } from '../fallback';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import {
  autoEnrollCanvasFont, getDynamicFace, isCanvasFont, isExplicitCanvasFont, listCanvasFonts, registerCanvasFont,
  unregisterCanvasFont, _resetDynamicFontsForTests, __setGlyphRasterizerForTests, type DynamicFace,
} from './dynamicAtlas';

const RUNS = 300;
const FAMILIES = ['Futura', 'Georgia', 'Impact', 'georgia', 'Ä'] as const;

type Cmd =
  | { kind: 'register' | 'auto' | 'unregister' | 'face'; family: string }
  | { kind: 'policy'; policy: FontFallbackPolicy };

const family = fc.constantFrom(...FAMILIES);
const cmd: fc.Arbitrary<Cmd> = fc.oneof(
  { weight: 3, arbitrary: fc.record({ kind: fc.constantFrom('register' as const, 'auto' as const, 'unregister' as const), family }) },
  { weight: 2, arbitrary: fc.record({ kind: fc.constant('face' as const), family }) },
  { weight: 1, arbitrary: fc.record({ kind: fc.constant('policy' as const), policy: fc.constantFrom<FontFallbackPolicy>('substitute', 'canvas', 'none') }) },
);

beforeEach(() => {
  _resetDynamicFontsForTests();
  _resetFallbackForTests();
});

describe('canvas font enrollment, stateful', () => {
  it('serves an explicit family under every policy and an auto-enrolled one under canvas alone', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(cmd, { minLength: 1, maxLength: 40 }), (cmds) => {
      _resetDynamicFontsForTests();
      _resetFallbackForTests();
      __setGlyphRasterizerForTests({
        faceMetrics: () => ({ ascent: 40, descent: 8 }),
        rasterize: () => ({ width: 0, height: 0, alpha: new Uint8ClampedArray(0), left: 0, top: 0, advance: 10 }),
      });
      const explicit = new Set<string>();
      const auto = new Set<string>();
      const faces = new Map<string, DynamicFace>();
      let policy: FontFallbackPolicy = 'substitute';
      for (const c of cmds) {
        if (c.kind === 'register') { registerCanvasFont(c.family); explicit.add(c.family); auto.delete(c.family); }
        else if (c.kind === 'auto') { autoEnrollCanvasFont(c.family); if (!explicit.has(c.family)) auto.add(c.family); }
        else if (c.kind === 'unregister') { unregisterCanvasFont(c.family); explicit.delete(c.family); auto.delete(c.family); faces.delete(c.family); }
        else if (c.kind === 'policy') { setFontFallbackPolicy(c.policy); policy = c.policy; }
        else {
          const face = getDynamicFace(c.family, 400, 'normal');
          const before = faces.get(c.family);
          if (before && (explicit.has(c.family) || auto.has(c.family))) { expect(face).toBe(before); t.count('face kept'); }
          faces.set(c.family, face);
        }
        const served = (f: string): boolean => explicit.has(f) || (auto.has(f) && policy === 'canvas');
        for (const f of FAMILIES) {
          expect(isCanvasFont(f), f).toBe(served(f));
          expect(isExplicitCanvasFont(f), f).toBe(explicit.has(f));
          if (auto.has(f)) t.count(served(f) ? 'auto served' : 'auto lapsed');
        }
        const want = FAMILIES.filter(served).sort((a, b) => a.localeCompare(b))
          .map((f) => ({ family: f, enrollment: explicit.has(f) ? 'explicit' : 'auto' }));
        expect(listCanvasFonts()).toEqual(want);
      }
    }), runs(RUNS));
    t.atLeast('auto served', 50);
    t.atLeast('auto lapsed', 50);
    t.atLeast('face kept', 20);
  }, timeoutFor(RUNS, 2));
});
