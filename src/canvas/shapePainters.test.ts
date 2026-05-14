import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerShapePainter,
  findShapePainter,
  getShapePainters,
  _resetShapePaintersForTests,
  type ShapePainter,
} from './shapePainters';
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
  it('ships three built-ins in evaluation order: text → path → rect-fallback', () => {
    const ids = getShapePainters().map((p) => p.id);
    expect(ids).toEqual(['kit:text', 'kit:path', 'kit:rect-fallback']);
  });

  it('findShapePainter returns the first matching painter', () => {
    expect(findShapePainter(node({ text: 'hi' }))?.id).toBe('kit:text');
    expect(findShapePainter(node({ path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } }))?.id).toBe('kit:path');
    expect(findShapePainter(node({ color: '#abc' }))?.id).toBe('kit:rect-fallback');
  });

  it('registers a normal-priority painter — added after built-ins', () => {
    const custom: ShapePainter = {
      id: 'app:image',
      matches: (n) => (n.data as { image?: unknown } | null)?.image != null,
      paint: () => [],
    };
    registerShapePainter(custom);
    const ids = getShapePainters().map((p) => p.id);
    expect(ids).toEqual(['kit:text', 'kit:path', 'kit:rect-fallback', 'app:image']);
    // Because rect-fallback always matches, app:image never wins from
    // normal priority. That's a feature of the built-in order.
    expect(findShapePainter(node({ image: 'x' }))?.id).toBe('kit:rect-fallback');
  });

  it("'high' priority painters beat the built-ins", () => {
    const overrideText: ShapePainter = {
      id: 'app:loud-text',
      matches: (n) => (n.data as { text?: string } | null)?.text != null,
      paint: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } } as DrawCommand],
    };
    registerShapePainter(overrideText, { priority: 'high' });
    expect(findShapePainter(node({ text: 'hi' }))?.id).toBe('app:loud-text');
  });

  it('within a tier, painters run in registration order (first-wins)', () => {
    const a: ShapePainter = { id: 'a', matches: () => true, paint: () => [] };
    const b: ShapePainter = { id: 'b', matches: () => true, paint: () => [] };
    registerShapePainter(a, { priority: 'high' });
    registerShapePainter(b, { priority: 'high' });
    expect(findShapePainter(node({}))?.id).toBe('a');
  });

  it('disposer removes the painter', () => {
    const custom: ShapePainter = { id: 'temp', matches: () => true, paint: () => [] };
    const dispose = registerShapePainter(custom, { priority: 'high' });
    expect(findShapePainter(node({}))?.id).toBe('temp');
    dispose();
    expect(findShapePainter(node({}))?.id).toBe('kit:rect-fallback');
  });

  it('disposing twice is a no-op', () => {
    const custom: ShapePainter = { id: 'once', matches: () => true, paint: () => [] };
    const dispose = registerShapePainter(custom, { priority: 'high' });
    dispose();
    dispose();
    expect(getShapePainters().map((p) => p.id)).not.toContain('once');
  });
});
