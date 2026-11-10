import { describe, expect, it } from 'vitest';
import { checkPrefCondition } from './conditionCheck';
import type { PrefGroup } from './groups';
import { prefValueAtPath } from './helpers';
import { prefShownReader } from './shown';

const field = { kind: 'field', name: 'F', description: '', default: '' } as const;
const SCHEMA = {
  name: 'S',
  children: {
    u: {
      kind: 'union', name: 'U', description: '', tag: 'type', default: { type: 'p', d: {} },
      variants: {
        p: { kind: 'object', name: 'P', description: '', default: { d: {} }, children: { d: { kind: 'object', name: 'D', description: '', default: {}, children: {} } } },
        q: {
          kind: 'object', name: 'Q', description: '', default: { d: '' },
          children: {
            d: field,
            on: { kind: 'boolean', name: 'On', description: '', default: false, encoding: { read: (s) => s === 'yes', write: (on) => (on ? 'yes' : 'no') } },
          },
        },
        r: { kind: 'object', name: 'R', description: '', default: {}, children: { on: { kind: 'boolean', name: 'On', description: '', default: false } } },
      },
    },
  },
} satisfies PrefGroup;

describe('a field two variants of a union describe differently (shrunk)', () => {
  it('is not reported as never holding a value one of the variants holds', () => {
    expect(checkPrefCondition({ path: 'u.d', is: '' }, SCHEMA)).toEqual([]);
  });

  it('is still reported for a value no variant holds', () => {
    expect(checkPrefCondition({ path: 'u.d', is: 3 }, SCHEMA).map((p) => p.code)).toEqual(['value']);
  });

  it('is shown as the variant the value holds describes it', () => {
    const shown = (u: unknown) => prefShownReader(SCHEMA, (path) => prefValueAtPath({ u }, path));
    expect(shown({ type: 'q', on: 'yes' })('u.on')).toBe(true);
    expect(shown({ type: 'r', on: 'yes' })('u.on')).toBe('yes');
  });
});
