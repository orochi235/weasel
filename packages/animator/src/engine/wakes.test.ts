import { describe, expect, it } from 'vitest';
import { createWakes, type Waiting } from './wakes';

interface Item extends Waiting { name: string }
let seq = 0;
const item = (name: string): Item => ({ name, wakeAt: Infinity, heapAt: -1, seq: seq++ });
const names = (items: Item[]): string[] => items.map((i) => i.name);

describe('createWakes', () => {
  it('hands out what is due, and keeps the rest', () => {
    const w = createWakes<Item>();
    const [a, b, c] = [item('a'), item('b'), item('c')];
    w.set(a, 30);
    w.set(b, 10);
    w.set(c, 20);
    expect(names(w.due(5))).toEqual([]);
    expect(names(w.due(20))).toEqual(['b', 'c']);
    expect(w.size).toBe(1);
    expect(b.heapAt).toBe(-1);
    expect(names(w.due(30))).toEqual(['a']);
  });

  it('orders those due together by `seq`, whatever times they waited for', () => {
    const w = createWakes<Item>();
    const [a, b, c] = [item('a'), item('b'), item('c')];
    w.set(a, 3);
    w.set(b, 1);
    w.set(c, 2);
    expect(names(w.due(10))).toEqual(['a', 'b', 'c']);
  });

  it('moves one given another time, and drops one removed', () => {
    const w = createWakes<Item>();
    const [a, b, c] = [item('a'), item('b'), item('c')];
    w.set(a, 10);
    w.set(b, 20);
    w.set(c, 30);
    w.set(a, 40);
    w.remove(b);
    w.remove(b);
    expect(w.size).toBe(2);
    expect(names(w.due(35))).toEqual(['c']);
    expect(names(w.due(40))).toEqual(['a']);
  });

  it('keeps its order through many joins and leaves', () => {
    const w = createWakes<Item>();
    const items = Array.from({ length: 200 }, (_, i) => item(String(i)));
    // A fixed scramble: 37 and 200 share no factor.
    items.forEach((it, i) => w.set(it, (i * 37) % 200));
    for (let i = 0; i < 200; i += 3) w.remove(items[i]!);
    let last = -1;
    for (let now = 0; now < 200; now += 7) {
      for (const it of w.due(now)) {
        expect(it.wakeAt).toBeGreaterThan(last - 7);
        expect(it.wakeAt).toBeLessThanOrEqual(now);
        expect(Number(it.name) % 3).not.toBe(0);
      }
      last = now;
    }
    expect(w.due(Infinity).length).toBeLessThanOrEqual(3);
  });
});
