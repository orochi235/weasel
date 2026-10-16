import { describe, expect, it } from 'vitest';
import type { AnchorSet } from './anchorEdits';
import type { PenAnchor } from './anchors';
import {
  cornerAnchors, everyNthAnchor, growAnchorSelection, invertAnchorSelection, shrinkAnchorSelection, smoothAnchors,
} from './anchorSelection';

const corner = (x: number): PenAnchor => ({ x, y: 0 });
const smooth = (x: number): PenAnchor => ({ x, y: 0, inHandle: { x: x - 1, y: 0 }, outHandle: { x: x + 1, y: 0 } });

/** An open subpath of six anchors (flat 0–5), then a closed one of four (6–9). */
function twoSubpaths(): AnchorSet {
  return {
    anchors: [
      [corner(0), smooth(1), smooth(2), corner(3), smooth(4), corner(5)],
      [corner(10), corner(11), smooth(12), corner(13)],
    ],
    closed: [false, true],
  };
}

describe('growAnchorSelection', () => {
  it('adds each selected anchor’s neighbors within its subpath', () => {
    expect(growAnchorSelection(twoSubpaths(), [2])).toEqual([1, 2, 3]);
  });
  it('stops at an open end and wraps round a closed subpath', () => {
    expect(growAnchorSelection(twoSubpaths(), [0, 5])).toEqual([0, 1, 4, 5]);
    expect(growAnchorSelection(twoSubpaths(), [6])).toEqual([6, 7, 9]);
  });
});

describe('shrinkAnchorSelection', () => {
  it('drops the anchors at the edges of a run', () => {
    expect(shrinkAnchorSelection(twoSubpaths(), [1, 2, 3, 4])).toEqual([2, 3]);
  });
  it('erodes a run from an open end', () => {
    expect(shrinkAnchorSelection(twoSubpaths(), [0, 1, 2])).toEqual([1]);
  });
  it('leaves a closed subpath selected all the way round', () => {
    expect(shrinkAnchorSelection(twoSubpaths(), [6, 7, 8, 9])).toEqual([6, 7, 8, 9]);
  });
  it('undoes a grow of a lone anchor in the middle of a run', () => {
    const set = twoSubpaths();
    expect(shrinkAnchorSelection(set, growAnchorSelection(set, [2]))).toEqual([2]);
  });
});

describe('everyNthAnchor', () => {
  it('counts from each subpath’s first anchor when nothing is selected', () => {
    expect(everyNthAnchor(twoSubpaths(), 2)).toEqual([0, 2, 4, 6, 8]);
  });
  it('counts from the first selected anchor, only in subpaths holding one', () => {
    expect(everyNthAnchor(twoSubpaths(), 3, [1])).toEqual([1, 4]);
  });
  it('walks a closed subpath once round from the selected anchor', () => {
    expect(everyNthAnchor(twoSubpaths(), 3, [7])).toEqual([6, 7]);
  });
  it('treats n below 1 as 1', () => {
    expect(everyNthAnchor(twoSubpaths(), 0, [8])).toEqual([6, 7, 8, 9]);
  });
});

describe('anchors by kind', () => {
  it('splits every anchor into corners and smooth ones', () => {
    expect(cornerAnchors(twoSubpaths())).toEqual([0, 3, 5, 6, 7, 9]);
    expect(smoothAnchors(twoSubpaths())).toEqual([1, 2, 4, 8]);
  });
  it('inverts a selection across subpaths', () => {
    expect(invertAnchorSelection(twoSubpaths(), [0, 3, 5, 6, 7, 9])).toEqual([1, 2, 4, 8]);
  });
});
