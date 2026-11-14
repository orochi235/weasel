import { describe, expect, it } from 'vitest';
import { resolveSize } from './density';

describe('resolveSize', () => {
  it("takes the control's own size over the scope", () => {
    expect(resolveSize('md', 'sm')).toBe('md');
  });

  it('takes the scope when the control sets none', () => {
    expect(resolveSize(undefined, 'sm')).toBe('sm');
    expect(resolveSize(undefined, 'md', 'sm')).toBe('md');
  });

  it("falls back to md, or the control's own default, with neither", () => {
    expect(resolveSize(undefined, undefined)).toBe('md');
    expect(resolveSize(undefined, undefined, 'sm')).toBe('sm');
  });
});
