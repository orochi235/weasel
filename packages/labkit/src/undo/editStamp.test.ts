import { describe, expect, it } from 'vitest';
import { editStamp, seedEditStamp } from './editStamp';

describe('editStamp', () => {
  // Shrunk from `records.pbt.test.ts`: past 2^43 a thousandth rounded away and two stamps tied.
  it('rises past a restored stamp too large for a thousandth to move', () => {
    seedEditStamp(2.823732471474843e297);
    const a = editStamp();
    expect(a).toBeGreaterThan(2.823732471474843e297);
    expect(editStamp()).toBeGreaterThan(a);
  });
});
