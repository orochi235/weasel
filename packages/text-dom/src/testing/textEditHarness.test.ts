import { expect, it } from 'vitest';
import { makeRichHarness } from './textEditHarness';

it('keeps a node whose id names an Object.prototype member as an entry of its own', () => {
  const h = makeRichHarness({});
  expect(h.opts.getText('constructor')).toBe('');
  h.opts.setText!('__proto__', 'x');
  expect(h.opts.getText('__proto__')).toBe('x');
  expect(Object.keys(h.data)).toEqual(['__proto__']);
});
