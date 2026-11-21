import { describe, expect, it } from 'vitest';
import { resolveTextStyle } from '@weasel-js/text';
import { domToRuns, runsToDom } from './domRuns';

describe('domRuns — an upright run in italic text', () => {
  it('keeps italic: false through the overlay', () => {
    const el = document.createElement('div');
    runsToDom([{ text: 'a' }, { text: 'b', italic: false }], el, resolveTextStyle({ fontStyle: 'italic' }));
    const runs = domToRuns(el);
    expect(runs.find((r) => r.text === 'b')).toMatchObject({ italic: false });
    expect(runs.find((r) => r.text === 'a')?.italic).toBeUndefined();
  });
});
