import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerNodeShape,
  findNodeShape,
  findShapeSilhouette,
  shapeCoversPoint,
  getNodeShapes,
  _resetShapePaintersForTests,
  type NodeShapeEntry,
} from './NodeShape';
import { registerFont, FIXTURE_FONT } from '@weasel-js/font';
import { _resetFontRegistryForTests } from '@weasel-js/font/test-seams';
import { pathContainsPoint } from 'features/paths/pathHitTest';
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '../renderer';
import type { PolygonPath } from 'features/paths/types';

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
    kind: 'leaf',
    layer: 'default',
    pose: { x: 0, y: 0, width: 0, height: 0 },
    data,
    parent: null,
  } as Node<TData, 'default', { x: number; y: number; width: number; height: number }>;
}

beforeEach(() => {
  // Tests freely register/unregister; reset before each so cross-test
  // pollution can't leak. After reset, only the kit built-ins are
  // registered (text, path, rect-fallback).
  _resetShapePaintersForTests();
});

describe('shape painter registry', () => {
  it('ships five built-ins in evaluation order: text → path → shape → image → rect-fallback', () => {
    const ids = getNodeShapes().map((p) => p.id);
    expect(ids).toEqual(['kit:text', 'kit:path', 'kit:shape', 'kit:image', 'kit:rect-fallback']);
  });

  it('findNodeShape returns the first matching painter', () => {
    expect(findNodeShape(node({ text: 'hi' }))?.id).toBe('kit:text');
    expect(findNodeShape(node({ path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } }))?.id).toBe('kit:path');
    expect(findNodeShape(node({ color: '#abc' }))?.id).toBe('kit:rect-fallback');
  });

  it('registers a normal-priority painter — added after built-ins', () => {
    const custom: NodeShapeEntry = {
      id: 'app:image',
      matches: (n) => (n.data as { image?: unknown } | null)?.image != null,
      paint: () => [],
    };
    registerNodeShape(custom);
    const ids = getNodeShapes().map((p) => p.id);
    expect(ids).toEqual(['kit:text', 'kit:path', 'kit:shape', 'kit:image', 'kit:rect-fallback', 'app:image']);
    // Because rect-fallback always matches, app:image never wins from
    // normal priority. That's a feature of the built-in order.
    expect(findNodeShape(node({ image: 'x' }))?.id).toBe('kit:rect-fallback');
  });

  it("'high' priority painters beat the built-ins", () => {
    const overrideText: NodeShapeEntry = {
      id: 'app:loud-text',
      matches: (n) => (n.data as { text?: string } | null)?.text != null,
      paint: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } } as DrawCommand],
    };
    registerNodeShape(overrideText, { priority: 'high' });
    expect(findNodeShape(node({ text: 'hi' }))?.id).toBe('app:loud-text');
  });

  it('within a tier, painters run in registration order (first-wins)', () => {
    const a: NodeShapeEntry = { id: 'a', matches: () => true, paint: () => [] };
    const b: NodeShapeEntry = { id: 'b', matches: () => true, paint: () => [] };
    registerNodeShape(a, { priority: 'high' });
    registerNodeShape(b, { priority: 'high' });
    expect(findNodeShape(node({}))?.id).toBe('a');
  });

  it('disposer removes the painter', () => {
    const custom: NodeShapeEntry = { id: 'temp', matches: () => true, paint: () => [] };
    const dispose = registerNodeShape(custom, { priority: 'high' });
    expect(findNodeShape(node({}))?.id).toBe('temp');
    dispose();
    expect(findNodeShape(node({}))?.id).toBe('kit:rect-fallback');
  });

  it('disposing twice is a no-op', () => {
    const custom: NodeShapeEntry = { id: 'once', matches: () => true, paint: () => [] };
    const dispose = registerNodeShape(custom, { priority: 'high' });
    dispose();
    dispose();
    expect(getNodeShapes().map((p) => p.id)).not.toContain('once');
  });
});

describe('findShapeSilhouette rotation', () => {
  function poseNode(pose: object): Node<{ color: string }, 'default', object> {
    return { id: 'n', kind: 'leaf', layer: 'default', pose, data: { color: '#abc' }, parent: null } as never;
  }

  it('returns the unrotated silhouette for a pose with no rotation', () => {
    const sil = findShapeSilhouette(poseNode({ x: 0, y: 0, width: 20, height: 10 }), { x: 0, y: 0, width: 20, height: 10 });
    expect(sil).toEqual({ kind: 'rect', x: 0, y: 0, width: 20, height: 10 });
  });

  it('bakes pose.rotation into the silhouette — world coords, not the unrotated shape', () => {
    const pose = { x: 0, y: 0, width: 20, height: 10, rotation: Math.PI / 2 };
    const sil = findShapeSilhouette(poseNode(pose), pose) as PolygonPath;
    expect(sil.kind).toBe('polygon');
    // Corner (0,0) rotated 90° about center (10,5) lands at (15,-5).
    expect(sil.coords[0]).toBeCloseTo(15);
    expect(sil.coords[1]).toBeCloseTo(-5);
  });
});

describe('kit:text painter — rich runs', () => {
  const pose = { x: 10, y: 20, width: 100, height: 40 };
  const paintText = (data: unknown): DrawCommand[] => {
    const n = { ...node(data), pose };
    return findNodeShape(n)!.paint(n, pose);
  };

  it('paints a plain-text node as one unstyled run', () => {
    const [cmd] = paintText({ text: 'hi', style: { fontSize: 16 } });
    expect(cmd.kind).toBe('text');
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs).toHaveLength(1);
    expect(text.runs[0].text).toBe('hi');
  });

  it('paints the node\'s runs when it has them, not the flattened string', () => {
    // Without this the run algebra is write-only in the default scene layer:
    // a styled range commits to `data.runs` and paints as if it were never
    // styled, because the painter re-flattened `data.text`.
    const [cmd] = paintText({
      text: 'ab',
      style: { fontSize: 16 },
      runs: [{ text: 'a', bold: true }, { text: 'b' }],
    });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs.map((r) => r.text)).toEqual(['a', 'b']);
    expect(text.runs[0].fontWeight).toBeGreaterThan(text.runs[1].fontWeight);
  });

  it('carries run-level decoration and tracking through to the command', () => {
    const [cmd] = paintText({
      text: 'ab',
      style: { fontSize: 16 },
      runs: [{ text: 'a', underline: true, letterSpacing: 2 }, { text: 'b' }],
    });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs[0].underline).toBe(true);
    expect(text.runs[0].letterSpacing).toBe(2);
    expect(text.runs[1].underline).toBe(false);
  });

  it('falls back to the plain string when `runs` is empty', () => {
    const [cmd] = paintText({ text: 'hi', style: { fontSize: 16 }, runs: [] });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.runs.map((r) => r.text)).toEqual(['hi']);
  });

  // `kit:shape` already reads `data.stroke` / `data.strokeWidth` off the
  // kit-native leaf shape. Text reading the same two fields is what makes a
  // consumer's one pair of stroke controls mean the same thing on a text node
  // as on a rect, instead of silently doing nothing.
  describe('kit-native stroke fields', () => {
    it('lifts data.stroke / data.strokeWidth onto the text style', () => {
      const [cmd] = paintText({ text: 'hi', stroke: '#f00', strokeWidth: 3 });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.style.stroke).toEqual({ paint: { color: '#f00' }, width: 3 });
    });

    it('takes a whole Stroke, and ignores data.strokeWidth when it gets one', () => {
      const stroke = { paint: { color: '#f00' }, width: 3, cap: 'round' as const };
      const [cmd] = paintText({ text: 'hi', stroke, strokeWidth: 9 });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.style.stroke).toEqual(stroke);
    });

    it('defaults the width to 1 when only a colour is set', () => {
      const [cmd] = paintText({ text: 'hi', stroke: '#f00' });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.style.stroke?.width).toBe(1);
    });

    it('leaves the style alone for stroke: none or a zero width', () => {
      for (const data of [
        { text: 'hi', stroke: 'none', strokeWidth: 3 },
        { text: 'hi', stroke: '#f00', strokeWidth: 0 },
        { text: 'hi' },
      ]) {
        const [cmd] = paintText(data);
        expect((cmd as Extract<DrawCommand, { kind: 'text' }>).style.stroke).toBeUndefined();
      }
    });

    it('an explicit style.stroke wins over the leaf fields', () => {
      const explicit = { paint: { color: '#00f' }, width: 8, join: 'round' as const };
      const [cmd] = paintText({
        text: 'hi', stroke: '#f00', strokeWidth: 3, style: { stroke: explicit },
      });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.style.stroke).toBe(explicit);
    });

    it('reaches runs-form text too', () => {
      const [cmd] = paintText({
        text: 'ab', stroke: '#f00', strokeWidth: 2, runs: [{ text: 'a' }, { text: 'b' }],
      });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.runs.every((r) => r.stroke?.width === 2)).toBe(true);
    });
  });

  // A `TextDrawCommand`'s `y` is the top of the first line box — `layoutRuns`
  // walks *down* from it to the baseline (`common.base * scale`), and
  // `verticalAlign` aligns the block within `[y, y + height]`. The painter
  // used to pass `pose.y + fontSize`, as if `y` were a baseline, which put
  // every kit:text node's baseline about two ems below its box top and hung
  // the descenders outside the pose entirely. It also disagreed with
  // `createTextLayer` and with the DOM editing overlay, both of which anchor
  // on `pose.y` — so text jumped a whole line on commit.
  it('anchors the command on the pose box top, not a baseline', () => {
    for (const fontSize of [16, 48]) {
      const [cmd] = paintText({ text: 'hi', style: { fontSize } });
      const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
      expect(text.x).toBe(pose.x);
      expect(text.y).toBe(pose.y);
      // The box forwarded for vertical alignment is the pose's own box.
      expect(text.height).toBe(pose.height);
    }
  });

  it('anchors runs-form text on the pose box top too', () => {
    const [cmd] = paintText({
      text: 'ab',
      style: { fontSize: 48 },
      runs: [{ text: 'a' }, { text: 'b' }],
    });
    const text = cmd as Extract<DrawCommand, { kind: 'text' }>;
    expect(text.y).toBe(pose.y);
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

  it('returns null for a node with no visible text, so it stays pickable', () => {
    // An empty box has no lines to cover; a zero-area silhouette would make it
    // unselectable. `null` means "no opinion" and the caller keeps the AABB.
    expect(findShapeSilhouette(textNode({ text: '' }), wide)).toBeNull();
  });

  it('does not wrap where the paint does not', () => {
    // `paint` deliberately withholds `maxWidth`, so kit:text never wraps. A
    // silhouette measured against `pose.width` would wrap and report line
    // boxes the renderer never drew.
    const n = textNode({ text: 'AAAA BBBB AAAA', style: { fontSize: 20 } });
    const narrow = { x: 0, y: 0, width: 40, height: 100 };
    const sil = findShapeSilhouette({ ...node(n.data), pose: narrow }, narrow)!;
    // One unwrapped line: ink continues past the 40-unit pose width, and
    // nothing sits on a second line.
    expect(pathContainsPoint(sil, 60, 5)).toBe(true);
    expect(pathContainsPoint(sil, 5, 30)).toBe(false);
  });
});

describe('shapeCoversPoint', () => {
  it('narrows a pose rect to the painted shape', () => {
    // An ellipse inscribed in its pose: the pose corner is inside the rect but
    // outside the drawn shape.
    const pose = { x: 0, y: 0, width: 100, height: 100 };
    const n = { ...node({ shape: 'ellipse', fill: '#000' }), pose };
    expect(shapeCoversPoint(n, pose, 50, 50)).toBe(true);
    expect(shapeCoversPoint(n, pose, 2, 2)).toBe(false);
  });

  it('answers true when the painter has no silhouette', () => {
    // No opinion — the caller's own AABB test stands. Anything else would
    // silently make whole classes of node unpickable.
    const pose = { x: 0, y: 0, width: 10, height: 10 };
    const n = { ...node({ color: '#abc' }), pose }; // kit:rect-fallback
    expect(shapeCoversPoint(n, pose, 5, 5)).toBe(true);
  });
});

describe('data.stroke as a whole Stroke', () => {
  const pose = { x: 0, y: 0, width: 100, height: 100 };
  const RECT = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
  const strokeOf = (data: unknown): unknown => {
    const n = { ...node(data), pose };
    const [cmd] = findNodeShape(n)!.paint(n, pose);
    return (cmd as { stroke?: unknown }).stroke;
  };

  it('carries cap, join, dash and miter limit that the color form cannot express', () => {
    const stroke = {
      paint: { color: '#0f0' }, width: 12, cap: 'round', join: 'bevel',
      dash: [8, 4], miterLimit: 2,
    };
    // `strokeWidth` is ignored outright — the object is the whole answer.
    expect(strokeOf({ path: RECT, fill: 'none', stroke, strokeWidth: 3 })).toEqual(stroke);
  });

  it('reaches kit:shape the same way', () => {
    const stroke = { paint: { color: '#0f0' }, width: 4, dash: [2, 2] };
    expect(strokeOf({ shape: 'ellipse', fill: '#fff', stroke })).toEqual(stroke);
  });

  it('bakes a bounds-relative stroke gradient onto the pose box, as a fill is baked', () => {
    // Left unbaked, the paint would reach the renderer in `'bounds'` fractions
    // describing a frame that no longer exists — the pose is already in the path.
    const paint = {
      fill: 'linear-gradient' as const,
      from: { x: 0, y: 0 }, to: { x: 1, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      units: 'bounds' as const,
    };
    const out = strokeOf({ path: RECT, fill: 'none', stroke: { paint, width: 6 } }) as {
      paint: { units: string; from: { x: number }; to: { x: number } };
    };
    expect(out.paint.units).toBe('local');
    expect(out.paint.to.x).toBe(100);
  });

  it("skips a 'none' stroke on kit:shape, which used to paint one colored 'none'", () => {
    expect(strokeOf({ shape: 'rect', fill: '#fff', stroke: 'none', strokeWidth: 4 })).toBeUndefined();
  });
});
