import { describe, it, expect, vi } from 'vitest';
import { makeGetNodeAtPoint } from './getNodeAtPoint';

describe('makeGetNodeAtPoint', () => {
  it('returns null when pickEvery returns null', () => {
    const fn = makeGetNodeAtPoint(() => null);
    expect(fn(0, 0)).toBeNull();
  });

  it('returns null when pickEvery returns an empty array', () => {
    const fn = makeGetNodeAtPoint(() => []);
    expect(fn(0, 0)).toBeNull();
  });

  it('returns the topmost id (first element) from an array', () => {
    const fn = makeGetNodeAtPoint(() => ['a', 'b', 'c']);
    const hit = fn(0, 0);
    expect(hit?.id).toBe('a');
  });

  it('handles a single string return from pickEvery', () => {
    const fn = makeGetNodeAtPoint(() => 'node-1');
    const hit = fn(0, 0);
    expect(hit?.id).toBe('node-1');
  });

  it('returns kind from nodeResolver', () => {
    const resolver = vi.fn(() => ({ kind: 'rect', pose: { x: 0, y: 0 }, data: { id: 'n1', type: 'rect' } }));
    const fn = makeGetNodeAtPoint(() => 'n1', resolver);
    const hit = fn(0, 0);
    expect(hit?.kind).toBe('rect');
    expect(resolver).toHaveBeenCalledWith('n1');
  });

  it('falls back to kind="unknown" when nodeResolver is absent', () => {
    const fn = makeGetNodeAtPoint(() => 'n1');
    const hit = fn(0, 0);
    expect(hit?.kind).toBe('unknown');
  });

  it('falls back to kind="unknown" when nodeResolver returns null', () => {
    const fn = makeGetNodeAtPoint(() => 'n1', () => null);
    const hit = fn(0, 0);
    expect(hit?.kind).toBe('unknown');
  });

  it('falls back to data={id} when nodeResolver returns null', () => {
    const fn = makeGetNodeAtPoint(() => 'n1', () => null);
    const hit = fn(0, 0);
    expect(hit?.data).toEqual({ id: 'n1' });
  });

  it('returns pose and data from nodeResolver', () => {
    const pose = { x: 10, y: 20, width: 100, height: 50 };
    const data = { id: 'n2', label: 'hello' };
    const fn = makeGetNodeAtPoint(() => 'n2', () => ({ kind: 'text', pose, data }));
    const hit = fn(0, 0);
    expect(hit?.pose).toBe(pose);
    expect(hit?.data).toBe(data);
  });

  it('passes world coords and the resolving camera through to pickEvery', () => {
    const pickEvery = vi.fn(() => null as string | null);
    const fn = makeGetNodeAtPoint(pickEvery);
    const camera = { scale: { x: 2, y: 2 } };
    fn(42, 99, camera);
    expect(pickEvery).toHaveBeenCalledWith(42, 99, camera);
  });

  it('passes the topmost id to nodeResolver, not all ids', () => {
    const resolver = vi.fn(() => ({ kind: 'rect', pose: {}, data: {} }));
    const fn = makeGetNodeAtPoint(() => ['top', 'bottom'], resolver);
    fn(0, 0);
    expect(resolver).toHaveBeenCalledWith('top');
    expect(resolver).toHaveBeenCalledTimes(1);
  });
});
