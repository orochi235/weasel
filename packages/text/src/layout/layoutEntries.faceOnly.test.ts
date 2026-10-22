import { describe, it, expect, beforeEach } from 'vitest';
import { registerFontOutlines, glyphOutline } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { layoutAndPaint } from './testing/layoutAndPaint';
import { resolveRuns, type ResolvedRun } from '../runs/resolveRuns';
import { DEFAULT_TEXT_FILL, resolveTextStyle } from '../textStyle';
import { stubFetch } from './testing/fontFixtures';

beforeEach(() => {
  _resetFontRegistryForTests();
  stubFetch();
});

/**
 * The outline tier as a *metrics* source, not a paint upgrade.
 *
 * Every other test here registers an atlas first, because until now that was
 * the only way a family could resolve at all. A consumer holding font bytes
 * and nothing else — no bake step, no `registerFont` — is the case this
 * covers.
 */
describe('layoutRuns from a font face alone', () => {
  const OUTLINE_D = 'M0 0L0.5 -0.7L1 0Z';

  /** Metrics chosen so every assertion below is exact: 0.5em per glyph,
   *  0.25em for a space, and one kerned pair. */
  function registerFaceOnly(family: string): void {
    registerFontOutlines(family, { weight: 400, style: 'normal' }, new ArrayBuffer(4), {
      parser: () => ({
        unitsPerEm: 1000,
        ascender: 0.8,
        advanceOf: (cp: number) => (cp === 32 ? 0.25 : 0.5),
        // 'AV' only, so an unkerned pair proves the lookup is per-pair.
        kernOf: (l: number, r: number) => (l === 65 && r === 86 ? -0.1 : 0),
        glyphD: (cp: number) => (cp === 32 ? null : OUTLINE_D),
      }),
    });
  }

  /** The registry answers `null` until the (async) load lands. */
  async function settle(family: string): Promise<void> {
    glyphOutline(family, 400, 'normal', 65);
    await new Promise((r) => setTimeout(r, 0));
  }

  function runsOf(text: string, family: string, fontSize: number): ResolvedRun[] {
    return resolveRuns([{ text }], resolveTextStyle({ fontFamily: family, fontSize }, { fill: DEFAULT_TEXT_FILL }));
  }

  it('lays out with no atlas registered at all', async () => {
    const family = 'face-only';
    registerFaceOnly(family);
    await settle(family);

    const out = layoutAndPaint(runsOf('AB', family, 100), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });

    // Two glyphs at 0.5em of a 100-unit em.
    expect(out.bounds.width).toBeCloseTo(100, 5);
    expect(out.lines).toHaveLength(1);
    // Baseline is the face's ascender, not an atlas's `common.base`.
    expect(out.lines[0].baselineY).toBeCloseTo(80, 5);

    // One group, on the outline tier, carrying geometry and no quads.
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].source).toBe('outline');
    expect(out.groups[0].quads).toHaveLength(0);
    expect(out.groups[0].glyphs.map((g) => g.x)).toEqual([0, 50]);
    expect(out.groups[0].glyphs[0].scale).toBe(100);
  });

  it('kerns from the face, per pair', async () => {
    const family = 'face-kern';
    registerFaceOnly(family);
    await settle(family);

    const kerned = layoutAndPaint(runsOf('AV', family, 100), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });
    const plain = layoutAndPaint(runsOf('AB', family, 100), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });

    // -0.1em pulls the second glyph in, and the line width follows it.
    expect(kerned.groups[0].glyphs.map((g) => g.x)).toEqual([0, 40]);
    expect(kerned.bounds.width).toBeCloseTo(90, 5);
    expect(plain.bounds.width).toBeCloseTo(100, 5);
  });

  it('wraps on the face\'s own advances', async () => {
    const family = 'face-wrap';
    registerFaceOnly(family);
    await settle(family);

    // 'AB' is 100 wide, a space 25: two words fit in 225, not in 200.
    const wide = layoutAndPaint(runsOf('AB AB', family, 100), {
      maxWidth: 225, lineHeight: 1.2, align: 'left',
    });
    const narrow = layoutAndPaint(runsOf('AB AB', family, 100), {
      maxWidth: 200, lineHeight: 1.2, align: 'left',
    });

    expect(wide.lines).toHaveLength(1);
    expect(narrow.lines).toHaveLength(2);
  });

  it('needs no outlineMinSize — there is no tier below it to prefer', async () => {
    const family = 'face-nogate';
    registerFaceOnly(family);
    await settle(family);

    // The gate exists to keep small text on an SDF tier. This family has none,
    // so gating it would paint nothing.
    const out = layoutAndPaint(runsOf('A', family, 8), {
      maxWidth: Infinity, lineHeight: 1.2, align: 'left',
    });

    expect(out.groups[0].glyphs).toHaveLength(1);
  });
});
