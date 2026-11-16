import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { pathContainsPoint, type PolygonPath } from '@weasel-js/geom';
import { findShapeSilhouette, type SceneNode as Node } from '@weasel-js/core';
import { _resetShapePaintersForTests } from 'canvas/NodeShape';
import { withTextPainter } from '../testing/textPainter';

/** Serve FIXTURE_FONT (glyphs 'A' and 'B') to `registerFont`. */
function stubFontFetch(): void {
  const encoder = new TextEncoder();
  global.fetch = vi.fn().mockImplementation((url: string) => (
    url.endsWith('.json')
      ? Promise.resolve({ ok: true, json: () => Promise.resolve(FIXTURE_FONT) })
      : Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([encoder.encode('PNG')], { type: 'image/png' })),
      })
  )) as typeof fetch;
  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 512, height: 512, close: vi.fn(),
  } as unknown as ImageBitmap);
}

function node<TData>(data: TData): Node<TData, 'default', { x: number; y: number; width: number; height: number }> {
  return {
    id: 'n',
    kind: 'mark',
    layer: 'default',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data,
    parent: null,
  } as Node<TData, 'default', { x: number; y: number; width: number; height: number }>;
}

beforeEach(() => _resetShapePaintersForTests());
withTextPainter();

describe('kit:text painter — silhouette across a font load', () => {
  it('measures again once the face has landed', async () => {
    _resetFontRegistryForTests();
    stubFontFetch();
    const pose = { x: 0, y: 0, width: 400, height: 100 };
    const n = { ...node({ text: 'AB', style: { fontSize: 20 } }), pose };
    const pending = findShapeSilhouette(n, pose);
    await registerFont('sans-serif', {}, '/f.json', '/f.png');
    const landed = findShapeSilhouette(n, pose);
    expect(landed).not.toBeNull();
    expect(landed).not.toBe(pending);
    expect(findShapeSilhouette(n, pose)).toBe(landed);
  });
});

describe('kit:text painter — silhouette', () => {
  // FIXTURE_FONT covers 'A' and 'B' only, and registers under the default
  // family so `resolveTextStyle` finds it.
  beforeEach(async () => {
    _resetFontRegistryForTests();
    stubFontFetch();
    await registerFont('sans-serif', {}, '/f.json', '/f.png');
  });

  const wide = { x: 0, y: 0, width: 400, height: 100 };
  const textNode = (data: unknown) => ({ ...node(data), pose: wide });

  it('covers the text, not the empty remainder of the wrap box', () => {
    const n = textNode({ text: 'AB', style: { fontSize: 20 } });
    const sil = findShapeSilhouette(n, wide)!;
    expect(sil).not.toBeNull();
    // Just right of the glyphs, still well inside the pose rect.
    expect(pathContainsPoint(sil, 5, 5)).toBe(true);
    expect(pathContainsPoint(sil, 390, 5)).toBe(false);
    // Below the single line, still inside the 100-tall pose.
    expect(pathContainsPoint(sil, 5, 90)).toBe(false);
  });

  it('is one contour per line', () => {
    const n = textNode({ text: 'AB\nAB', style: { fontSize: 20, lineHeight: 1.2 } });
    const sil = findShapeSilhouette(n, wide) as PolygonPath;
    expect(sil.kind).toBe('polygon');
    expect(pathContainsPoint(sil, 5, 5)).toBe(true);   // line 1
    expect(pathContainsPoint(sil, 5, 30)).toBe(true);  // line 2
    expect(pathContainsPoint(sil, 5, 70)).toBe(false); // past the last line
  });

  // Picking has to follow the paint: a centered glyph that draws halfway down
  // its box but silhouettes at the top is grabbable off its own ink.
  it('shifts by the same verticalAlign offset the paint applies', () => {
    const top = findShapeSilhouette(textNode({ text: 'AB', style: { fontSize: 20 } }), wide) as PolygonPath;
    const centered = findShapeSilhouette(
      textNode({ text: 'AB', style: { fontSize: 20 }, verticalAlign: 'center' }),
      wide,
    ) as PolygonPath;
    // The 100-tall box holds one ~24-unit line, so centering drops it ~38 down.
    expect(centered.coords[1] - top.coords[1]).toBeGreaterThan(20);
    expect(pathContainsPoint(centered, 5, 5)).toBe(false);
    expect(pathContainsPoint(centered, 5, 50)).toBe(true);
  });

  it('returns null for a node with no visible text, so it stays pickable', () => {
    // An empty box has no lines to cover; a zero-area silhouette would make it
    // unselectable. `null` means "no opinion" and the caller keeps the AABB.
    expect(findShapeSilhouette(textNode({ text: '' }), wide)).toBeNull();
  });

  it('wraps exactly where the paint does', () => {
    const narrow = { x: 0, y: 0, width: 40, height: 100 };
    const text = 'AAAA BBBB AAAA';
    const sil = findShapeSilhouette({ ...node({ text, style: { fontSize: 20 } }), pose: narrow }, narrow)!;
    // One unwrapped line: ink continues past the 40-unit pose width, and
    // nothing sits on a second line.
    expect(pathContainsPoint(sil, 100, 5)).toBe(true);
    expect(pathContainsPoint(sil, 5, 30)).toBe(false);
    const wrapped = findShapeSilhouette(
      { ...node({ text, style: { fontSize: 20, wrap: true } }), pose: narrow }, narrow,
    )!;
    // 'AAAA ' is the whole first line, about 62 wide.
    expect(pathContainsPoint(wrapped, 100, 5)).toBe(false);
    expect(pathContainsPoint(wrapped, 5, 30)).toBe(true);
  });

  it('follows center and right alignment within the pose width', () => {
    const centered = findShapeSilhouette(
      textNode({ text: 'AB', style: { fontSize: 20, align: 'center' } }), wide,
    )!;
    expect(pathContainsPoint(centered, 200, 5)).toBe(true);
    expect(pathContainsPoint(centered, 5, 5)).toBe(false);
    const right = findShapeSilhouette(
      textNode({ text: 'AB', style: { fontSize: 20, align: 'right' } }), wide,
    )!;
    expect(pathContainsPoint(right, 395, 5)).toBe(true);
    expect(pathContainsPoint(right, 5, 5)).toBe(false);
  });
});
