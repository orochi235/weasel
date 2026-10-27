import { describe, it, expect, vi } from 'vitest';
import { makeGetNodeAtPoint } from './getNodeAtPoint';

describe('makeGetNodeAtPoint', () => {
  it('returns null when the picker returns null', () => {
    const fn = makeGetNodeAtPoint(() => null);
    expect(fn({ x: 0, y: 0 })).toBeNull();
  });

  it('reports the id the picker returns', () => {
    const fn = makeGetNodeAtPoint(() => 'node-1');
    const hit = fn({ x: 0, y: 0 });
    expect(hit?.id).toBe('node-1');
  });

  it('returns kind from nodeResolver', () => {
    const resolver = vi.fn(() => ({ kind: 'rect' }));
    const fn = makeGetNodeAtPoint(() => 'n1', resolver);
    const hit = fn({ x: 0, y: 0 });
    expect(hit?.kind).toBe('rect');
    expect(resolver).toHaveBeenCalledWith('n1');
  });

  it('falls back to kind="unknown" when nodeResolver is absent', () => {
    const fn = makeGetNodeAtPoint(() => 'n1');
    const hit = fn({ x: 0, y: 0 });
    expect(hit?.kind).toBe('unknown');
  });

  it('falls back to kind="unknown" when nodeResolver returns null', () => {
    const fn = makeGetNodeAtPoint(() => 'n1', () => null);
    const hit = fn({ x: 0, y: 0 });
    expect(hit?.kind).toBe('unknown');
  });

  it('passes world coords and the resolving camera through to the picker', () => {
    const pickEvery = vi.fn(() => null as string | null);
    const fn = makeGetNodeAtPoint(pickEvery);
    const camera = { scale: { x: 2, y: 2 } };
    fn({ x: 42, y: 99 }, camera);
    expect(pickEvery).toHaveBeenCalledWith({ x: 42, y: 99 }, camera);
  });
});
