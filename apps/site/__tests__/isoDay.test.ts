import { afterEach, describe, expect, it } from 'vitest';
import { ageOf, isoDay } from '../isoDay';

const TZ = process.env.TZ;
afterEach(() => {
  if (TZ === undefined) delete process.env.TZ;
  else process.env.TZ = TZ;
});

describe('a demo date', () => {
  it('falls in the same month on the demo page as its day does on Demo updates, wherever the reader is', () => {
    const iso = '2026-10-31T22:00:00-05:00';
    const later = Date.parse('2027-03-01T00:00:00Z');
    for (const tz of ['America/Chicago', 'UTC', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      expect(isoDay(iso), tz).toBe('2026-11-01');
      expect(ageOf(iso, later), tz).toMatch(/Nov.*2026/);
    }
  });

  it('reads as days or weeks while it is recent', () => {
    const now = Date.parse('2026-11-19T12:00:00Z');
    expect(ageOf('2026-11-19T09:00:00Z', now)).toBe('today');
    expect(ageOf('2026-11-16T09:00:00Z', now)).toBe('3d ago');
    expect(ageOf('2026-11-01T09:00:00Z', now)).toBe('2w ago');
  });
});
