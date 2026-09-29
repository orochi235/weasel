/**
 * `textToPath` against real glyph geometry — the bundled Inter subset, parsed
 * by the default opentype.js parser. A stub face would prove the plumbing and
 * nothing about where the outlines land, which is the whole contract.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { registerFont, registerFontOutlines, loadFontOutlines, type OutlineFace } from '@weasel-js/font';
import { _resetFontRegistryForTests, _resetFontOutlinesForTests } from '@weasel-js/font/test-seams';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import { layoutTextPose, type TextPose } from '@weasel-js/text';
import { boundsOfPath, pointInPath, pathFromD, PATH_C, PATH_Q, type Path } from '@weasel-js/geom';
import {
  textToPath, textToPathsByPaint, loadTextOutlines, TextOutlinesError, type TextOutlineSource,
} from './textToPath';

const INTER = resolve(import.meta.dirname, '../../../../../assets/fonts/inter');

function ttf(): ArrayBuffer {
  // Copied into this realm's own ArrayBuffer: every jsdom test file runs in
  // its own realm, and the registry tells a buffer from a Blob by instanceof.
  return new Uint8Array(readFileSync(`${INTER}/inter.ttf`)).buffer;
}

/** Register Inter's baked atlas under `family`, from the real metrics file. */
async function registerAtlas(family: string): Promise<void> {
  const metrics = JSON.parse(readFileSync(`${INTER}/inter.json`, 'utf8'));
  global.fetch = vi.fn().mockImplementation((url: string) => (url.endsWith('.json')
    ? Promise.resolve({ ok: true, json: () => Promise.resolve(metrics) })
    : Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['PNG'])) }))) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
  await registerFont(family, {}, `/${family}.json`, `/${family}.png`);
}

const POSE = { x: 10, y: 20, width: 600, height: 200 };

/** Half-em squares on the baseline: 'A' wound clockwise on screen, 'B' the other way. */
const SQUARES: OutlineFace = {
  unitsPerEm: 1000,
  ascender: 0.8,
  advanceOf: () => 0.6,
  kernOf: () => 0,
  glyphD: (cp) => (cp === 65 ? 'M0 -0.5L0.5 -0.5L0.5 0L0 0Z'
    : cp === 66 ? 'M0 -0.5L0 0L0.5 0L0.5 -0.5Z' : null),
};

const text = (s: string, style: TextOutlineSource['style'] = {}): TextOutlineSource => ({
  text: s, style: { fontFamily: 'outline-inter', fontSize: 100, ...style },
});

/** Where the laid-out text's first baseline sits in world space. */
function baseline(src: TextOutlineSource, pose = POSE): number {
  const tp: TextPose = { ...pose, text: src.text, style: src.style };
  const { laid, y } = layoutTextPose(tp);
  return y + laid.lines[0].baselineY;
}

beforeEach(async () => {
  _resetFontRegistryForTests();
  _resetFontOutlinesForTests();
  _resetLayoutCacheForTests();
  registerFontOutlines('outline-inter', {}, ttf());
  await loadFontOutlines('outline-inter');
});

describe('textToPath', () => {
  it('places a glyph in world space: on the baseline, starting at the pen', () => {
    const src = text('H');
    const path = textToPath(src, POSE);
    const b = boundsOfPath(path);
    // 'H' has a flat bottom on the baseline and a cap height of ~0.73 em.
    expect(b.y + b.height).toBeCloseTo(baseline(src), 3);
    expect(b.height).toBeGreaterThan(65);
    expect(b.height).toBeLessThan(80);
    expect(b.x).toBeGreaterThanOrEqual(POSE.x);
    expect(b.x).toBeLessThan(POSE.x + 15);
  });

  it('fills the stems and leaves the gap between them empty', () => {
    const path = textToPath(text('H'), POSE);
    const b = boundsOfPath(path);
    const midY = b.y + b.height * 0.25;
    expect(pointInPath(path, b.x + 3, midY)).toBe(true);
    expect(pointInPath(path, b.x + b.width / 2, midY)).toBe(false);
  });

  it('keeps the font\'s curves rather than flattening them', () => {
    const path = textToPath(text('O'), POSE);
    expect(path.kind).toBe('polygon');
    if (path.kind !== 'polygon') return;
    const curves = Array.from(path.commands).filter((c) => c === PATH_C || c === PATH_Q);
    expect(curves.length).toBeGreaterThan(0);
  });

  it('keeps a counter as a hole', () => {
    const path = textToPath(text('O'), POSE);
    const b = boundsOfPath(path);
    expect(pointInPath(path, b.x + b.width / 2, b.y + b.height / 2)).toBe(false);
  });

  it('works for text below the outline threshold on a face that has an atlas', async () => {
    await registerAtlas('atlas-inter');
    registerFontOutlines('atlas-inter', {}, ttf());
    await loadFontOutlines('atlas-inter');
    const small = { text: 'H', style: { fontFamily: 'atlas-inter', fontSize: 12 } };
    const b = boundsOfPath(textToPath(small, POSE));
    expect(b.height).toBeGreaterThan(8);
    expect(b.height).toBeLessThan(10);
  });

  it('rotates with the pose about its box center', () => {
    const upright = boundsOfPath(textToPath(text('H'), POSE));
    const turned = boundsOfPath(textToPath(text('H'), { ...POSE, rotation: Math.PI / 2 }));
    expect(turned.width).toBeCloseTo(upright.height, 2);
    expect(turned.height).toBeCloseTo(upright.width, 2);
  });

  it('shears a synthetic italic by the renderer\'s oblique angle', async () => {
    // Synthetic italic is an atlas-tier fallback: an upright atlas standing in
    // for an italic request, with upright outlines behind it.
    await registerAtlas('atlas-inter');
    registerFontOutlines('atlas-inter', {}, ttf());
    await loadFontOutlines('atlas-inter');
    const l = (fontStyle: 'normal' | 'italic') => boundsOfPath(textToPath(
      { text: 'l', style: { fontFamily: 'atlas-inter', fontSize: 100, fontStyle } }, POSE));
    const regular = l('normal');
    const italic = l('italic');
    // A shear moves each point by tan(12°) of its height above the baseline,
    // so the bounds widen by that much over the glyph's full height.
    expect(italic.width - regular.width).toBeCloseTo(regular.height * Math.tan(0.2094), 1);
    expect(italic.height).toBeCloseTo(regular.height, 3);
  });

  it('fills where overlapping glyphs meet, whatever each face\'s own winding', () => {
    // Two square glyphs wound opposite ways, the way a TrueType and a CFF face
    // disagree. Tracked so they overlap across x = 30..50.
    registerFontOutlines('squares', {}, new ArrayBuffer(4), { parser: () => SQUARES });
    return loadFontOutlines('squares').then(() => {
      const src = { text: 'AB', style: { fontFamily: 'squares', fontSize: 100, letterSpacing: -30 } };
      const path = textToPath(src, POSE);
      const y = baseline(src) - 25;
      expect(pointInPath(path, POSE.x + 10, y)).toBe(true);
      expect(pointInPath(path, POSE.x + 40, y)).toBe(true);
      expect(pointInPath(path, POSE.x + 70, y)).toBe(true);
    });
  });

  it('fills a rule across a glyph wound against it', async () => {
    registerFontOutlines('squares', {}, new ArrayBuffer(4), { parser: () => SQUARES });
    await loadFontOutlines('squares');
    const src = { text: 'B', style: { fontFamily: 'squares', fontSize: 100, strikethrough: true } };
    const tp: TextPose = { ...POSE, text: src.text, style: src.style };
    const { laid, x, y } = layoutTextPose(tp);
    const [rule] = laid.decorations;
    const path = textToPath(src, POSE);
    expect(pointInPath(path, x + 25, y + (rule.y0 + rule.y1) / 2)).toBe(true);
  });

  it('keeps real overlaps filled in a real face', () => {
    const path = textToPath(text('ll', { letterSpacing: -30 }), POSE);
    const b = boundsOfPath(path);
    const y = b.y + b.height / 2;
    for (let x = b.x + 1; x < b.x + b.width - 1; x += 1) {
      expect(pointInPath(path, x, y), `x=${x}`).toBe(true);
    }
  });

  it('includes decoration rules, unioned with the glyphs they cross', () => {
    const plain = textToPath(text('p'), POSE);
    const ruled = textToPath(text('p', { underline: true }), POSE);
    const tp: TextPose = { ...POSE, text: 'p', style: text('p', { underline: true }).style };
    const { laid, x, y } = layoutTextPose(tp);
    const [rule] = laid.decorations;
    expect(rule).toBeDefined();
    // Probe inside the band where rule and glyph overlap: the font's own rule
    // can straddle the descender's tip, which a probe at the rule's center misses.
    const glyph = boundsOfPath(plain);
    const ry = (y + rule.y0 + Math.min(y + rule.y1, glyph.y + glyph.height)) / 2;
    // Somewhere along the rule the descender crosses it: inside both, and
    // inside the union — a rule wound against the glyph would cut a hole.
    let crossed = false;
    for (let px = x + rule.x0; px < x + rule.x1; px += 0.5) {
      if (!pointInPath(plain, px, ry)) {
        expect(pointInPath(ruled, px, ry), `rule at x=${px}`).toBe(true);
        continue;
      }
      crossed = true;
      expect(pointInPath(ruled, px, ry), `crossing at x=${px}`).toBe(true);
    }
    expect(crossed).toBe(true);
  });

  it('returns an empty path for text with no ink', () => {
    const path = textToPath(text('   '), POSE) as Path;
    expect(path.kind === 'polygon' && path.commands.length).toBe(0);
  });

  it('agrees with the geometry the renderer places for the outline tier', () => {
    // Same glyph, same placement math: the layout's own glyph record, placed
    // by scale-and-translate, has the extraction's bounds.
    const src = text('H');
    const tp: TextPose = { ...POSE, text: src.text, style: src.style };
    const { laid, x, y } = layoutTextPose(tp);
    const g = laid.groups[0].glyphs[0];
    const em = boundsOfPath(pathFromD(g.d));
    const b = boundsOfPath(textToPath(src, POSE));
    expect(b.x).toBeCloseTo(x + g.x + em.x * g.scale, 3);
    expect(b.y).toBeCloseTo(y + g.baselineY + em.y * g.scale, 3);
  });
});

describe('textToPath failures', () => {
  it('throws a typed error for a face with no registered outlines', async () => {
    await registerAtlas('atlas-only');
    const src = { text: 'H', style: { fontFamily: 'atlas-only', fontSize: 40 } };
    expect(() => textToPath(src, POSE)).toThrow(TextOutlinesError);
    try { textToPath(src, POSE); } catch (err) {
      expect((err as TextOutlinesError).reason).toBe('no-outlines');
      expect((err as TextOutlinesError).family).toBe('atlas-only');
    }
  });

  it('reports synthetic bold as unsupported rather than drawing the regular weight', async () => {
    await registerAtlas('bold-me');
    registerFontOutlines('bold-me', {}, ttf());
    await loadFontOutlines('bold-me');
    const src = { text: 'H', style: { fontFamily: 'bold-me', fontSize: 40, fontWeight: 700 } };
    try {
      textToPath(src, POSE);
      expect.unreachable('synthetic bold must not extract');
    } catch (err) {
      expect(err).toBeInstanceOf(TextOutlinesError);
      expect((err as TextOutlinesError).reason).toBe('synthetic-bold');
      expect((err as TextOutlinesError).weight).toBe(700);
    }
  });

  it('reports a face whose bytes have not loaded, and succeeds once they have', async () => {
    registerFontOutlines('late', {}, ttf());
    const src = { text: 'H', style: { fontFamily: 'late', fontSize: 40 } };
    try {
      textToPath(src, POSE);
      expect.unreachable('an unloaded face has no geometry yet');
    } catch (err) {
      expect((err as TextOutlinesError).reason).toBe('outlines-loading');
    }
    await loadTextOutlines(src);
    expect(boundsOfPath(textToPath(src, POSE)).height).toBeGreaterThan(25);
  });

  it('reports a face whose bytes failed to parse', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await registerAtlas('broken');
    registerFontOutlines('broken', {}, new ArrayBuffer(4));
    await loadFontOutlines('broken');
    const src = { text: 'H', style: { fontFamily: 'broken', fontSize: 40 } };
    expect(() => textToPath(src, POSE)).toThrow(expect.objectContaining({ reason: 'outlines-failed' }));
  });
});

describe('textToPathsByPaint', () => {
  const RED = { fill: 'solid', color: '#c00' } as const;
  const BLUE = { fill: 'solid', color: '#00c' } as const;
  const OUTLINE = { width: 2, paint: { fill: 'solid', color: '#0c0' } } as const;

  /** Whether `p` covers `(x, y)` in any of `paths` — their union, sampled. */
  const inAny = (paths: readonly Path[], x: number, y: number) => paths.some((p) => pointInPath(p, x, y));

  it('splits a node into one path per paint, whose union is the whole outline', () => {
    const src: TextOutlineSource = {
      ...text(''),
      runs: [{ text: 'He' }, { text: 'll', fill: BLUE }, { text: 'o', underline: true }],
      fill: RED,
    };
    const groups = textToPathsByPaint(src, POSE);
    expect(groups.map((g) => g.fill)).toEqual([RED, BLUE]);
    expect(groups.every((g) => g.stroke === undefined)).toBe(true);

    const whole = textToPath(src, POSE);
    const parts = groups.map((g) => g.path);
    expect(parts.reduce((n, p) => n + p.commands.length, 0)).toBe(whole.commands.length);
    const b = boundsOfPath(whole);
    let inked = 0;
    for (let x = b.x; x <= b.x + b.width; x += 1.5) {
      for (let y = b.y; y <= b.y + b.height; y += 1.5) {
        const w = pointInPath(whole, x, y);
        if (w) inked++;
        expect(inAny(parts, x, y)).toBe(w);
      }
    }
    expect(inked).toBeGreaterThan(100);
    // 'll' is the blue group, and nothing else is in it.
    const blue = boundsOfPath(groups[1]!.path);
    const red = groups[0]!.path;
    expect(pointInPath(red, blue.x + blue.width / 2, blue.y + blue.height * 0.5)).toBe(false);
  });

  it('keys a group on fill and stroke together', () => {
    const src: TextOutlineSource = {
      ...text(''),
      runs: [{ text: 'A' }, { text: 'B', stroke: OUTLINE }, { text: 'C' }],
      fill: RED,
    };
    const groups = textToPathsByPaint(src, POSE);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ fill: RED });
    expect(groups[0]!.stroke).toBeUndefined();
    expect(groups[1]).toMatchObject({ fill: RED, stroke: OUTLINE });
  });

  it('gives plain text one group in the default text fill, and outlines unfilled text too', () => {
    const plain = textToPathsByPaint(text('Hi'), POSE);
    expect(plain).toHaveLength(1);
    expect(plain[0]!.fill).toEqual({ fill: 'solid', color: '#000' });

    const unfilled = textToPathsByPaint({ ...text('Hi'), fill: null }, POSE);
    expect(unfilled).toHaveLength(1);
    expect(unfilled[0]!.fill).toBeNull();
    expect(unfilled[0]!.path.commands.length).toBe(textToPath(text('Hi'), POSE).commands.length);
  });

  it('leaves out a paint whose runs have no ink', () => {
    const src: TextOutlineSource = { ...text(''), runs: [{ text: 'Hi' }, { text: '  ', fill: BLUE }] };
    expect(textToPathsByPaint(src, POSE)).toHaveLength(1);
    expect(textToPathsByPaint(text('   '), POSE)).toEqual([]);
  });
});
