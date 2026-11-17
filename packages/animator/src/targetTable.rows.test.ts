import { describe, expect, it } from 'vitest';
import { createTargetTable } from './targetTable';

describe("a target table's rows", () => {
  it('refuses to remove a row twice, so no two adds answer one row', () => {
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    t.add([0]);
    t.remove(a);
    expect(() => t.remove(a)).toThrow(/not in use/);
    expect(t.size).toBe(1);
    const c = t.add([1]);
    const d = t.add([2]);
    expect(c).not.toBe(d);
    expect(t.size).toBe(3);
  });

  it('refuses to remove, set, or target a row never added', () => {
    const t = createTargetTable({ axes: 1, capacity: 64 });
    t.add([0]);
    expect(() => t.remove(5)).toThrow(/not in use/);
    expect(() => t.set(500, [1])).toThrow(/not in use/);
    expect(() => t.target(500)).toThrow(/not in use/);
    expect(() => t.target(-1)).toThrow(/not in use/);
    expect(() => t.target(0.5)).toThrow(/not in use/);
    expect(t.size).toBe(1);
  });

  it('refuses to target a removed row', () => {
    const t = createTargetTable({ axes: 1 });
    const a = t.add([0]);
    t.remove(a);
    expect(() => t.target(a)).toThrow(/not in use/);
  });

  it('takes no row for a value of the wrong length', () => {
    const t = createTargetTable({ axes: 3 });
    const a = t.add([0, 0, 0]);
    t.remove(a);
    expect(() => t.add([1, 2])).toThrow(/3 numbers/);
    expect(t.size).toBe(0);
    expect(t.add([1, 2, 3])).toBe(a);
    expect(() => t.add([1])).toThrow(/3 numbers/);
    expect(t.add([4, 5, 6])).toBe(1);
  });
});
