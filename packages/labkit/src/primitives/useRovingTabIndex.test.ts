import { describe, expect, it } from 'vitest';
import { nextIndex } from './useRovingTabIndex';

describe('nextIndex', () => {
  it('steps forward and wraps', () => {
    expect(nextIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextIndex(2, 'ArrowRight', 3)).toBe(0);
  });

  it('steps back and wraps', () => {
    expect(nextIndex(1, 'ArrowLeft', 3)).toBe(0);
    expect(nextIndex(0, 'ArrowLeft', 3)).toBe(2);
  });

  it('jumps to the ends', () => {
    expect(nextIndex(1, 'Home', 3)).toBe(0);
    expect(nextIndex(1, 'End', 3)).toBe(2);
  });

  it('returns null for a key it does not handle', () => {
    expect(nextIndex(1, 'Enter', 3)).toBeNull();
  });

  it('returns null when there is nothing to move to', () => {
    expect(nextIndex(0, 'ArrowRight', 0)).toBeNull();
  });
});
