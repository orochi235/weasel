import { describe, expect, it } from 'vitest';
import { inkReach } from './nodePaint';

const paint = { color: '#000' };

describe('inkReach', () => {
  it('reaches as far as the widest point of a width profile', () => {
    const plain = inkReach({ paint, width: 4 }, 1);
    const swollen = inkReach({ paint, width: 4, widthProfile: [{ t: 0, width: 1 }, { t: 0.5, width: 3 }] }, 1);
    expect(plain.outset).toBe(2);
    expect(swollen.outset).toBe(6);
  });
});
