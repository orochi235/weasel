/** Steps and option keys that `steppedOption`'s and the tool option values' property tests shrank to. */
import { describe, expect, it } from 'vitest';
import type { PrefNumber } from '@weasel-js/prefs';
import { createToolOptionValues, heldToolOptions, steppedOption, toolOptionParams, type ToolOptions } from './toolOptions';

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

describe('tool option values, shrunk', () => {
  it('reads an option named __proto__ as an option', () => {
    const children = JSON.parse('{"__proto__":{"kind":"number","name":"P","description":"","default":3}}');
    const options: ToolOptions = { actionId: 'a', prefs: { name: 'T', description: '', children } };
    const values = createToolOptionValues();
    expect(Object.keys(toolOptionParams('t', options, values))).toEqual(['__proto__']);
    values.set('t', '__proto__', 4);
    expect(Object.getOwnPropertyDescriptor(heldToolOptions('t', options, values), '__proto__')?.value).toBe(4);
  });
});
