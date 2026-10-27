import { beforeEach, describe, expect, it } from 'vitest';
import type { StyledRun } from '@weasel-js/text';
import { domToRuns, runsToDom } from './domRuns';

describe('domRuns — lang', () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    parent = document.createElement('div');
    document.body.appendChild(parent);
  });

  it("sets a run's lang on its span, and reads it back", () => {
    const runs: StyledRun[] = [{ text: 'i' }, { text: 'i', lang: 'tr' }];
    runsToDom(runs, parent);
    const spans = parent.querySelectorAll<HTMLElement>('span[data-run]');
    expect([...spans].map((s) => s.getAttribute('lang'))).toEqual([null, 'tr']);
    expect(domToRuns(parent)).toEqual(runs);
  });

  it('reads a lang on pasted markup as inherited, and an empty one as none', () => {
    parent.innerHTML = '<span lang="tr">a<b>b</b><span lang="">c</span></span>';
    expect(domToRuns(parent)).toEqual([
      { text: 'a', lang: 'tr' },
      { text: 'b', bold: true, lang: 'tr' },
      { text: 'c' },
    ]);
  });

  it("does not read the overlay's own lang onto its runs", () => {
    parent.lang = 'tr';
    runsToDom([{ text: 'i' }], parent);
    expect(domToRuns(parent)).toEqual([{ text: 'i' }]);
  });
});
