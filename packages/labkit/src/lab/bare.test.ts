import { afterEach, describe, expect, it } from 'vitest';
import { bareOf } from './bare';
import { presentationStart } from './presentation';

afterEach(() => history.replaceState(null, '', '/'));

describe('bareOf', () => {
  it('answers null without `bare`', () => {
    expect(bareOf('')).toBeNull();
    expect(bareOf('?still&bg=fff')).toBeNull();
  });

  it('reads `?bare` as chromeless and moving', () => {
    expect(bareOf('?bare')).toEqual({ still: null, bg: null });
    expect(bareOf('?bare=')).toEqual({ still: null, bg: null });
  });

  it('reads `?bare=still` and `?bare=still=<ms>`', () => {
    expect(bareOf('?bare=still')).toEqual({ still: {}, bg: null });
    expect(bareOf('?bare=still=1200')).toEqual({ still: { at: 1200 }, bg: null });
    expect(bareOf('?bare=still=soon')).toEqual({ still: {}, bg: null });
  });

  it('reads `bg` as 3, 4, 6 or 8 hex digits, with or without #', () => {
    expect(bareOf('?bare&bg=FFF')?.bg).toBe('#fff');
    expect(bareOf('?bare&bg=fff8')?.bg).toBe('#fff8');
    expect(bareOf('?bare&bg=102030')?.bg).toBe('#102030');
    expect(bareOf('?bare&bg=10203080')?.bg).toBe('#10203080');
    expect(bareOf('?bare&bg=%23abc')?.bg).toBe('#abc');
  });

  it('drops a `bg` that is no hex color', () => {
    for (const bg of ['ff', 'fffff', '1020304', '102030405', 'red', 'ggg', ''])
      expect(bareOf(`?bare&bg=${bg}`)?.bg).toBeNull();
  });

  it("reads the page's own query string by default", () => {
    history.replaceState(null, '', '/?bare=still=50&bg=000');
    expect(bareOf()).toEqual({ still: { at: 50 }, bg: '#000' });
  });
});

describe('presentationStart with `?bare`', () => {
  it('presents, chromeless, on the URL alone', () => {
    history.replaceState(null, '', '/?bare&bg=123456');
    expect(presentationStart(undefined, undefined)).toEqual({
      presenting: true,
      still: null,
      bg: '#123456',
    });
  });

  it('holds still for `?bare=still`, with `<Lab still>` taking precedence', () => {
    history.replaceState(null, '', '/?bare=still=300');
    expect(presentationStart(undefined, undefined).still).toEqual({ at: 300 });
    expect(presentationStart(undefined, 900).still).toEqual({ at: 900 });
  });
});
