import { describe, expect, it } from 'vitest';
import { plainReason } from './reasons';

describe('plainReason', () => {
  it('says a known axe reason in plain words', () => {
    expect(plainReason({ key: 'bgOverlap', message: "Element's background color could not be determined because it is overlapped by another element" })).toBe(
      "axe couldn't tell the background: another element lies on top of this one.",
    );
    expect(plainReason({ key: 'pseudoContent' })).toMatch(/::before or ::after/);
  });

  it('falls back to axe’s own sentence for a reason it has no words for', () => {
    expect(plainReason({ key: 'colorParse', message: 'Could not parse color string wat(1)' })).toBe('Could not parse color string wat(1)');
    expect(plainReason({ message: 'Unable to determine contrast ratio' })).toBe('Unable to determine contrast ratio');
  });

  it('has nothing to say without a reason', () => {
    expect(plainReason(undefined)).toBeNull();
    expect(plainReason({ key: 'neverHeardOfIt' })).toBeNull();
  });
});
