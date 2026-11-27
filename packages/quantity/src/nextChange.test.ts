import { describe, expect, it } from 'vitest';
import {
  bytes,
  decimal,
  duration,
  instant,
  nextChangeFor,
  present,
  registerDisplayKind,
  relative,
  searchedChange,
  tag,
  textOf,
  partsOf,
  type Display,
  type Quantity,
} from './index';

const en = { locale: 'en-US' };

/** The text of `q` moved by `rate × t`. */
function textAfter(q: number, display: Display, rate: number, t: number, unit?: string): string {
  return present(tag(q + rate * t, display, unit), undefined, en).text;
}

/** That the answer lands on the change: the text has turned at it and had not a little before. */
function expectLandsOnChange(value: number, display: Display, rate: number, unit?: string): number {
  const t = nextChangeFor(tag(value, display, unit), rate, undefined, en);
  expect(t).toBeGreaterThan(0);
  const before = textAfter(value, display, rate, 0, unit);
  expect(textAfter(value, display, rate, t, unit)).not.toBe(before);
  expect(textAfter(value, display, rate, t * 0.999, unit)).toBe(before);
  return t;
}

describe('nextChangeFor', () => {
  it('finds the next whole second of a clock duration', () => {
    // `0:12` rounds to `0:13` at 12.5 s.
    expect(nextChangeFor(12.2, 1, duration(), en)).toBeCloseTo(0.3, 3);
    expectLandsOnChange(12.2, duration(), 1);
  });

  it('measures the wait in the unit of time the rate is per', () => {
    // A second per millisecond-of-host-time rate of 1/1000: the same change, a thousand times longer.
    expect(nextChangeFor(12.2, 1 / 1000, duration(), en)).toBeCloseTo(300, 0);
  });

  it('counts down to the boundary below', () => {
    expect(nextChangeFor(12.2, -1, duration(), en)).toBeCloseTo(0.7, 3);
    expectLandsOnChange(12.2, duration(), -1);
  });

  it('never changes at rate 0, or from infinity', () => {
    expect(nextChangeFor(12.2, 0, duration(), en)).toBe(Infinity);
    expect(nextChangeFor(Infinity, 1, duration(), en)).toBe(Infinity);
  });

  it('reads the decimals a display shows', () => {
    expect(nextChangeFor(1.24, 1, duration({ places: 1 }), en)).toBeCloseTo(0.01, 3);
    expectLandsOnChange(0.31, decimal({ places: 2 }), 0.5);
  });

  it('waits for a byte count to move its last shown digit', () => {
    expectLandsOnChange(1_234_000, bytes(), 10_000);
  });

  it('asks the kind first', () => {
    const off = registerDisplayKind({ kind: 'steady', format: (v) => [{ type: 'number', value: String(v) }], nextChange: () => 42 });
    try {
      expect(nextChangeFor(tag(1, { kind: 'steady' }), 1)).toBe(42);
    } finally {
      off();
    }
  });
});

describe('searchedChange', () => {
  it('gives up on text that never changes', () => {
    expect(searchedChange(() => 'same', 3, 1)).toBe(Infinity);
  });
});

describe('instant', () => {
  const at = Date.UTC(2026, 10, 26, 14, 32, 5) / 1000;

  it('writes a date and time from epoch seconds', () => {
    expect(present(tag(at, instant({ timeZone: 'UTC' })), undefined, en).text).toBe('Nov 26, 2026, 2:32 PM');
    expect(present(tag(at, instant({ iso: 'minute', timeZone: 'UTC' })), undefined, en).text).toBe('2026-11-26 14:32');
    expect(present(tag(at, instant({ iso: 'second', timeZone: 'UTC' })), undefined, en).text).toBe('2026-11-26 14:32:05');
    expect(
      present(tag(at, instant({ fields: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, timeZone: 'UTC' })), undefined, en).text,
    ).toBe('14:32');
  });

  it('reads epoch milliseconds through a unit tag, and shares duration\'s value space', () => {
    const ms: Quantity = tag(at * 1000, instant({ iso: 'second', timeZone: 'UTC' }), 'ms');
    expect(present(ms, undefined, en).text).toBe('2026-11-26 14:32:05');
    // An instant plus a span is an instant; two instants apart are a duration.
    expect(present(tag(at + 90, instant({ iso: 'second', timeZone: 'UTC' })), undefined, en).text).toBe('2026-11-26 14:33:35');
    expect(present(tag(at + 90 - at, duration()), undefined, en).text).toBe('1:30');
  });

  it('counts from its origin', () => {
    expect(present(tag(0, instant({ iso: 'date', timeZone: 'UTC', origin: Date.UTC(2000, 0, 1) })), undefined, en).text).toBe('2000-01-01');
  });

  it('reads typed ISO text back', () => {
    const d = instant({ timeZone: 'UTC' });
    expect(partsOf(tag(at, d), undefined, en).some((p) => p.type === 'hour')).toBe(true);
    expect(textOf(partsOf(tag(at, d), undefined, en))).toBe('Nov 26, 2026, 2:32 PM');
  });

  it('changes when its last shown field does', () => {
    const t = expectLandsOnChange(at, instant({ iso: 'minute', timeZone: 'UTC' }), 1);
    expect(t).toBeCloseTo(55, 1);
  });
});

describe('relative', () => {
  const text = (seconds: number, d: Display = relative()) => present(tag(seconds, d), undefined, en).text;

  it('counts in the largest unit under its threshold, truncated', () => {
    expect(text(-30)).toBe('30 sec. ago');
    expect(text(-239)).toBe('3 min. ago');
    expect(text(2 * 3600 + 5)).toBe('in 2 hr.');
    expect(text(-3 * 86400)).toBe('3 days ago');
    expect(text(-0.4)).toBe('0 sec. ago');
  });

  it('takes thresholds and a smallest unit', () => {
    expect(text(-90 * 60, relative({ thresholds: { minute: 120 } }))).toBe('90 min. ago');
    expect(text(-30, relative({ smallest: 'minute' }))).toBe('0 min. ago');
  });

  it('speaks the long form', () => {
    expect(present(tag(-239, relative()), undefined, en).spoken).toBe('3 minutes ago');
  });

  it('reads a value tagged in ms', () => {
    expect(present(tag(-180_000, relative(), 'ms'), undefined, en).text).toBe('3 min. ago');
  });

  it('wakes on the next minute under an hour, then hours', () => {
    // 3 min 20 s ago, receding at a second a second: `4 min. ago` in 40 s.
    expect(nextChangeFor(tag(-200, relative()), -1, undefined, en)).toBeCloseTo(40, 6);
    // 2 hr 10 min ahead, coming closer: `in 1 hr.` once under 2 hours, 10 min from now.
    expect(nextChangeFor(tag(2 * 3600 + 600, relative()), -1, undefined, en)).toBeCloseTo(600, 1);
  });

  it('agrees with a search of its text at every scale and direction', () => {
    for (const s of [-0.4, -59.5, -61, -3599, 3601, -86399, 86401, -6.9 * 86400, -40 * 86400, 400 * 86400, -2e8]) {
      for (const rate of [-1, 1, -1 / 1000]) {
        const q = tag(s, relative());
        const own = nextChangeFor(q, rate, undefined, en);
        const found = searchedChange((v) => present(tag(v, relative()), undefined, en).text, s, rate);
        expect(own, `${s} at ${rate}`).toBeGreaterThan(0);
        // Its own answer lands a millisecond past the change; the search, within its tolerance.
        expect(Math.abs(own - found), `${s} at ${rate}`).toBeLessThan(Math.max(found * 1e-3, 2e-3 / Math.abs(rate)));
        expect(textAfter(s, relative(), rate, own)).not.toBe(textAfter(s, relative(), rate, 0));
      }
    }
  });
});
