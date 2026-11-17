import { describe, expect, it } from 'vitest';
import { resolveControlSize } from './controlSize';

describe('resolveControlSize', () => {
  it("takes the control's own size over the scope", () => {
    expect(resolveControlSize('md', 'sm')).toBe('md');
  });

  it('takes the scope when the control sets none', () => {
    expect(resolveControlSize(undefined, 'sm')).toBe('sm');
    expect(resolveControlSize(undefined, 'md', 'sm')).toBe('md');
  });

  it("falls back to md, or the control's own default, with neither", () => {
    expect(resolveControlSize(undefined, undefined)).toBe('md');
    expect(resolveControlSize(undefined, undefined, 'sm')).toBe('sm');
  });
});
