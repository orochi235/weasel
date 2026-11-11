/** Counterexamples `domRuns.pbt.test.ts` shrank to: styling the overlay's DOM used to lose on its way back. */
import { beforeEach, describe, expect, it } from 'vitest';
import type { StyledRun } from '@weasel-js/text';
import { domToRuns, runsToDom } from './domRuns';

let parent: HTMLDivElement;
beforeEach(() => {
  document.body.innerHTML = '';
  parent = document.createElement('div');
  document.body.appendChild(parent);
});

const roundTrip = (runs: StyledRun[]): StyledRun[] => { runsToDom(runs, parent); return domToRuns(parent); };

describe('domRuns round trip (shrunk)', () => {
  it('keeps a fontScale beside an absolute fontSize', () => {
    const runs = [{ text: 'a', fontSize: { px: 1 }, fontScale: 0.001 }];
    expect(roundTrip(runs)).toEqual(runs);
  });

  it('keeps a bold flag beside its own fontWeight', () => {
    const runs = [{ text: 'a', bold: true, fontWeight: 100 }];
    expect(roundTrip(runs)).toEqual(runs);
  });

  it('keeps a solid fill spelled as the browser does not spell it back', () => {
    const runs = [{ text: 'a', fill: { paint: { color: '#ff0000' } } }];
    expect(roundTrip(runs)).toEqual(runs);
    expect(roundTrip([{ text: 'a', fill: { paint: { kind: 'solid', color: 'not-a-color' } } }]))
      .toEqual([{ text: 'a', fill: { paint: { kind: 'solid', color: 'not-a-color' } } }]);
  });

  it('keeps a hard break when text is typed ahead of its stand-in', () => {
    runsToDom([{ text: '\u2028' }], parent);
    const stand = parent.querySelector('[data-break]')!.firstChild as Text;
    stand.insertData(0, 'a');
    expect(domToRuns(parent)).toEqual([{ text: 'a\u2028' }]);
  });
});
