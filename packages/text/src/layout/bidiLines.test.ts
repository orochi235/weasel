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

  it('hands out an order no caller can change for the next line', () => {
    // Lines of one length share an order, so it is frozen.
    const order = orderLine(null, 0, 4);
    expect(Object.isFrozen(order.visual) && Object.isFrozen(order.levels)).toBe(true);
    expect(orderLine(null, 9, 4)).toBe(order);
  });
});
