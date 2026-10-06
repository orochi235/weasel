import { afterEach, describe, expect, it } from 'vitest';
import { formatSeconds, parseSeconds, readPlayheadParam, writePlayheadParam } from './playheadUrl';

afterEach(() => {
  history.replaceState(null, '', '/');
});

describe('formatSeconds', () => {
  it('writes ms as seconds, to the millisecond, without trailing zeros', () => {
    expect(formatSeconds(1500)).toBe('1.5');
    expect(formatSeconds(0)).toBe('0');
    expect(formatSeconds(-300)).toBe('-0.3');
    expect(formatSeconds(1234.5678)).toBe('1.235');
    expect(formatSeconds(-0.2)).toBe('0');
  });
});

describe('parseSeconds', () => {
  it('reads seconds as ms', () => {
    expect(parseSeconds('1.5')).toBe(1500);
    expect(parseSeconds('-0.3')).toBe(-300);
    expect(parseSeconds('0')).toBe(0);
  });

  it('refuses anything that is not a finite number', () => {
    for (const text of ['', ' ', 'abc', '1.5s', 'Infinity', 'NaN', null]) expect(parseSeconds(text)).toBeNull();
  });
});

describe('the t param', () => {
  it("reads t from the route's params", () => {
    history.replaceState(null, '', '/#/x--a?t=2.25');
    expect(readPlayheadParam()).toBe(2250);
    history.replaceState(null, '', '/#/x--a');
    expect(readPlayheadParam()).toBeNull();
  });

  it('writes and removes t in place, keeping the knobs and the history state', () => {
    history.replaceState({ forgeRoute: { step: 3, inPlace: false } }, '', '/#/x--a?knob=1');
    const length = history.length;
    writePlayheadParam(1500);
    expect(location.hash).toBe('#/x--a?knob=1&t=1.5');
    expect(history.state).toEqual({ forgeRoute: { step: 3, inPlace: false } });
    writePlayheadParam(null);
    expect(location.hash).toBe('#/x--a?knob=1');
    expect(history.length).toBe(length);
  });
});
