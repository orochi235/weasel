import { describe, expect, it } from 'vitest';
import { inkReach } from './nodePaint';

const paint = { color: '#000' };

describe('inkReach', () => {
  it('reaches as far as the widest per-vertex width', () => {
    expect(inkReach({ paint, width: 4 }, 1).outset).toBe(2);
    expect(inkReach({ paint, width: 4, vertexWidths: [2, 12, 4] }, 1).outset).toBe(6);
  });
});
