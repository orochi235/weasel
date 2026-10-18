import { describe, expect, it } from 'vitest';
import { stretchSpan } from './match';
import type { Guide } from '../types';

describe('stretchSpan', () => {
  it('stretches a matched span to reach the snapped box', () => {
    const g: Guide = { id: 'a', axis: 'x', offset: 100, span: { min: 0, max: 50 } };
    expect(stretchSpan(g, 80, 120)?.span).toEqual({ min: 0, max: 120 });
    expect(stretchSpan(g, -10, 20)?.span).toEqual({ min: -10, max: 50 });
  });

  it('leaves a guide with no span, or no guide, alone', () => {
    const g: Guide = { id: 'a', axis: 'x', offset: 100 };
    expect(stretchSpan(g, 0, 10)).toBe(g);
    expect(stretchSpan(null, 0, 10)).toBeNull();
  });
});
