import { expect, test, vi } from 'vitest';
import { bidi } from '@weasel-js/bidi';
import { visualGraphemes as withEngine } from './visualGraphemes';

const visualGraphemes = (g: readonly string[], d: 'ltr' | 'rtl') => withEngine(g, d, bidi);

const chars = (s: string) => [...s];

test('left-to-right text in a left-to-right run keeps its order', () => {
  expect(visualGraphemes(chars('abc'), 'ltr').join('')).toBe('abc');
});

test('a Hebrew word inside English is shown reversed, in place', () => {
  expect(visualGraphemes(chars('ab אבג cd'), 'ltr').join('')).toBe('ab גבא cd');
});

test('a right-to-left run lays display order from the right, so an English word inside Hebrew still reads forward', () => {
  // Display order of 'אבג ab' under rtl is 'ab גבא'; laid from the right that is the reverse.
  expect(visualGraphemes(chars('אבג ab'), 'rtl').join('')).toBe([...'ab גבא'].reverse().join(''));
});

test('brackets in a right-to-left stretch take their mirrored glyph', () => {
  // Logical '(' is the rightmost glyph and shows as ')', so the run, laid from the right, starts with it.
  expect(visualGraphemes(chars('(א)'), 'rtl')).toEqual([')', 'א', '(']);
  expect(visualGraphemes(chars('א(ב)'), 'ltr')).toEqual(['(', 'ב', ')', 'א']);
});

test('a grapheme of several code points stays whole and in its own order', () => {
  const g = ['é', 'א', 'ב'];
  expect(visualGraphemes(g, 'ltr')).toEqual(['é', 'ב', 'א']);
});

test('bidi controls alone drop out', () => {
  expect(visualGraphemes(['a', '‫', 'b', '‬'], 'ltr')).toEqual(['a', 'b']);
});

test('with no engine registered, graphemes keep their logical order and controls drop out', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  expect(withEngine(chars('ab אבג'), 'ltr', null)).toEqual(chars('ab אבג'));
  expect(withEngine(['a', '\u202b', 'b', '\u202c'], 'ltr', null)).toEqual(['a', 'b']);
  expect(warn).toHaveBeenCalledOnce();
  expect(String(warn.mock.calls[0]![0])).toMatch(/^weasel CurvedLabel: /);
  warn.mockRestore();
});
