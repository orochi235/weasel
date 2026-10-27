import { describe, it, expect } from 'vitest';
import { orderLine } from './bidiLines';

describe('orderLine without an engine', () => {
  it('reads every line left to right in stored order, whatever its length', () => {
    for (const count of [0, 1, 3, 10, 3]) {
      const order = orderLine(null, 7, count);
      expect(order.visual).toEqual(Array.from({ length: count }, (_, i) => i));
      expect(order.levels).toEqual(new Array(count).fill(0));
    }
  });

  it('shares one order between lines of one length', () => {
    expect(orderLine(null, 9, 4)).toBe(orderLine(null, 0, 4));
  });
});
