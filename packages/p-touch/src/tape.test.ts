import { describe, expect, it } from 'vitest';
import { tapeForWidthMm } from './tape';

describe('tapeForWidthMm', () => {
  it('finds each cassette by its width, and the 3.5mm one by the 4 a status reply gives', () => {
    expect(tapeForWidthMm(12)?.name).toBe('12mm');
    expect(tapeForWidthMm(3.5)?.name).toBe('3.5mm');
    expect(tapeForWidthMm(4)?.name).toBe('3.5mm');
    expect(tapeForWidthMm(5)).toBeUndefined();
  });
});
