import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerNodeShape,
  findNodeShape,
  getNodeShapes,
  _resetShapePaintersForTests,
  type NodeShapeEntry,
} from './NodeShape';
import type { Node } from 'core/scene/types';
import type { DrawCommand } from '../renderer';

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
  it('ships four built-ins in evaluation order: text → path → shape → rect-fallback', () => {
    const ids = getNodeShapes().map((p) => p.id);
    expect(ids).toEqual(['kit:text', 'kit:path', 'kit:shape', 'kit:rect-fallback']);
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
    expect(ids).toEqual(['kit:text', 'kit:path', 'kit:shape', 'kit:rect-fallback', 'app:image']);
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
