import { describe, expect, it, vi } from 'vitest';
import { createSetPathOp } from './setPath';

describe('createSetPathOp', () => {
  it('calls setPath on the adapter with the new fields when applied', () => {
    const setPath = vi.fn();
    const op = createSetPathOp({
      id: 'a',
      from: { path: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 }, closed: true, params: { sides: 4 } },
      to:   { path: { kind: 'polygon', commands: new Uint8Array([1]), coords: new Float32Array([0, 0]) }, closed: false, params: undefined },
    });
    op.apply({ setPath });
    expect(setPath).toHaveBeenCalledWith('a', {
      path: { kind: 'polygon', commands: new Uint8Array([1]), coords: new Float32Array([0, 0]) },
      closed: false,
      params: undefined,
    });
  });

  it('invert() produces an op that restores `from`', () => {
    const setPath = vi.fn();
    const from = { path: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 }, closed: true, params: undefined };
    const to   = { path: { kind: 'polygon' as const, commands: new Uint8Array([1]), coords: new Float32Array([0, 0]) }, closed: false, params: undefined };
    const op = createSetPathOp({ id: 'a', from, to });
    const inv = op.invert();
    inv.apply({ setPath });
    expect(setPath).toHaveBeenCalledWith('a', from);
  });

  it('reports no-op return when from and to are structurally identical (still calls setPath idempotently)', () => {
    const same = { path: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 }, closed: true, params: undefined };
    const op = createSetPathOp({ id: 'a', from: same, to: same });
    const setPath = vi.fn();
    // apply still invokes setPath so downstream observers see consistent
    // op behavior; only the return value signals "no mutation" to history.
    expect(op.apply({ setPath })).toBe(false);
    expect(setPath).toHaveBeenCalledWith('a', same);
  });
});

describe('createSetPathOp: what a polygon path compares', () => {
  const polygon = (extra: Record<string, unknown> = {}) => ({
    kind: 'polygon' as const, commands: new Uint8Array([0, 1]), coords: new Float32Array([0, 0, 5, 5]), fillRule: 'nonzero', ...extra,
  });
  const fields = (path: unknown) => ({ path, closed: true, params: undefined });

  it.each([
    ['fillRule', { fillRule: 'evenodd' }],
    ['openFill', { openFill: 'never' }],
    ['corners', { corners: [{ shape: 'round', radius: 2 }, null] }],
  ])('reports a change that touches only %s', (_name, extra) => {
    const op = createSetPathOp({ id: 'a', from: fields(polygon()), to: fields(polygon(extra)) });
    expect(op.apply({ setPath: vi.fn() })).toBeUndefined();
  });

  it('reports a no-op for an equal copy carrying corners', () => {
    const corners = () => [{ shape: 'round', radius: 2 }, null];
    const op = createSetPathOp({ id: 'a', from: fields(polygon({ corners: corners() })), to: fields(polygon({ corners: corners() })) });
    expect(op.apply({ setPath: vi.fn() })).toBe(false);
  });
});
