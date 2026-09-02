import { describe, expect, it } from 'vitest';
import * as core from '../index';

describe('easing spec exports', () => {
  it('exports resolveEasing and cubicBezierEasing from the core barrel', () => {
    expect(typeof core.resolveEasing).toBe('function');
    expect(typeof core.cubicBezierEasing).toBe('function');
  });

  it('resolves a name through the barrel export', () => {
    expect(core.resolveEasing('easeOutBack')).toBe(core.easeOutBack);
  });
});
