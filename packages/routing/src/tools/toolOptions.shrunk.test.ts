/** Steps `steppedOption`'s property test shrank to. */
import { describe, expect, it } from 'vitest';
import type { PrefNumber } from '@weasel-js/prefs';
import { steppedOption } from './toolOptions';

const free: PrefNumber = { kind: 'number', name: 'S', description: '', default: 1 };

describe('steppedOption, shrunk', () => {
  it('grows a value below a millionth rather than rounding it to zero', () => {
    expect(steppedOption(free, 1e-7, { option: 's', times: 2 }, 1)).toBe(2e-7);
    expect(steppedOption(free, 1e-7, { option: 's', times: 2 }, -1)).toBe(5e-8);
  });

  it('keeps an amount finer than a millionth', () => {
    expect(steppedOption(free, 1, { option: 's', plus: 1e-9 }, 1)).toBe(1.000000001);
  });

  it('stops at the largest double rather than stepping a finite option to Infinity', () => {
    const next = steppedOption(free, Number.MAX_VALUE / 4, { option: 's', times: 10 }, 1);
    expect(Number.isFinite(next) && next > Number.MAX_VALUE / 4).toBe(true);
  });

  it('still sheds a sum\'s float noise', () => {
    expect(steppedOption(free, 0.6, { option: 's', plus: 0.1 }, 1)).toBe(0.7);
    expect(steppedOption(free, 0.1, { option: 's', plus: 0.2 }, 1)).toBe(0.3);
  });
});
