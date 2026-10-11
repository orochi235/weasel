import { describe, expect, it, vi } from 'vitest';
import { createSetCurveOp, type SetCurveAdapter } from './setCurveOp';
import type { ControlPoint } from './CurveEditor';

const FROM: ControlPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
const TO: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0.7 }, { x: 1, y: 1 }];

describe('createSetCurveOp', () => {
  it('apply calls adapter.setValue with `to`', () => {
    const setValue = vi.fn();
    const adapter: SetCurveAdapter = { setValue };
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO });
    op.apply(adapter);
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith('c1', TO);
  });

  it('invert produces a mirror op with from/to swapped', () => {
    const setValue = vi.fn();
    const adapter: SetCurveAdapter = { setValue };
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO });
    op.invert().apply(adapter);
    expect(setValue).toHaveBeenCalledWith('c1', FROM);
  });

  it('label round-trips through invert', () => {
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO, label: 'Edit curve' });
    expect(op.label).toBe('Edit curve');
    expect(op.invert().label).toBe('Edit curve');
  });

  it('coalesceKey round-trips through invert', () => {
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO, coalesceKey: 'curve:c1' });
    expect(op.coalesceKey).toBe('curve:c1');
    expect(op.invert().coalesceKey).toBe('curve:c1');
  });

  it('applies an edit that only locks a point', () => {
    const setValue = vi.fn();
    const to: ControlPoint[] = [{ x: 0, y: 0, locked: true }, { x: 1, y: 1 }];
    expect(createSetCurveOp({ id: 'c1', from: FROM, to }).apply({ setValue })).toBeUndefined();
    expect(setValue).toHaveBeenCalledWith('c1', to);
  });

  it('treats an absent lock and `locked: false` as the same point', () => {
    const setValue = vi.fn();
    const to: ControlPoint[] = [{ x: 0, y: 0, locked: false }, { x: 1, y: 1 }];
    expect(createSetCurveOp({ id: 'c1', from: FROM, to }).apply({ setValue })).toBe(false);
  });

  it('reports a no-op when from === to (structural equality)', () => {
    const same: ControlPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const op = createSetCurveOp({ id: 'c1', from: same, to: same.map((p) => ({ ...p })) });
    const result = op.apply({ setValue: vi.fn() });
    expect(result).toBe(false);
  });

  it('does NOT call adapter.setValue on no-op', () => {
    const setValue = vi.fn();
    const adapter: SetCurveAdapter = { setValue };
    const same: ControlPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const op = createSetCurveOp({ id: 'c1', from: same, to: same.map((p) => ({ ...p })) });
    const result = op.apply(adapter);
    expect(result).toBe(false);
    expect(setValue).not.toHaveBeenCalled();
  });
});
