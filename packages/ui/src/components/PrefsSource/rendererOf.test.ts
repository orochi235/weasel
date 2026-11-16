import { describe, expect, it } from 'vitest';
import { rendererOf } from './rendererOf';

describe('rendererOf', () => {
  const draw = () => null;

  it('takes the first key the record holds as its own', () => {
    expect(rendererOf({ number: draw }, 'data.size', 'number')).toBe(draw);
    expect(rendererOf({ 'data.size': draw }, 'data.size', 'number')).toBe(draw);
    expect(rendererOf(undefined, 'number')).toBeUndefined();
  });

  it('finds no renderer for a path or kind named for an Object.prototype key', () => {
    expect(rendererOf<typeof draw>({}, 'constructor', 'toString')).toBeUndefined();
  });
});
