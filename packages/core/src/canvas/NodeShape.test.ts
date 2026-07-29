import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerNodeShape,
  findNodeShape,
  findShapeSilhouette,
  getNodeShapes,
  _resetShapePaintersForTests,
  type NodeShapeEntry,
} from './NodeShape';
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '../renderer';
import type { PolygonPath } from 'features/paths/types';

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
});
