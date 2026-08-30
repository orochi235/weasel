import { describe, it, expect } from 'vitest';
import { paragraphLevelOf, matchingPDI } from './paragraph';
import type { BidiClass } from './types';

const C = (s: string): BidiClass[] => s.split(' ') as BidiClass[];

describe('P2/P3 — paragraph embedding level', () => {
  it('is 0 when the first strong character is L', () => {
    expect(paragraphLevelOf(C('L R AL'))).toBe(0);
  });

  it('is 1 when the first strong character is R', () => {
    expect(paragraphLevelOf(C('R L'))).toBe(1);
  });

  it('is 1 when the first strong character is AL', () => {
    expect(paragraphLevelOf(C('AL L'))).toBe(1);
  });

  it('is 0 when there is no strong character at all', () => {
    expect(paragraphLevelOf(C('EN WS ON AN'))).toBe(0);
  });

  it('ignores weak and neutral characters before the first strong one', () => {
    expect(paragraphLevelOf(C('EN ON WS R'))).toBe(1);
  });

  it('skips over an isolate when looking for the first strong character', () => {
    // The L inside the isolate must not decide the paragraph: P2 jumps from
    // the initiator to its matching PDI.
    expect(paragraphLevelOf(C('RLI L PDI R'))).toBe(1);
  });

  it('skips to the end when an isolate initiator has no matching PDI', () => {
    // Nothing after the initiator counts, so no strong character is found.
    expect(paragraphLevelOf(C('LRI R R'))).toBe(0);
  });

  it('still sees a strong character before the isolate', () => {
    expect(paragraphLevelOf(C('R LRI L PDI'))).toBe(1);
  });
});

describe('BD9 — matching PDI', () => {
  it('finds the PDI that closes an isolate initiator', () => {
    expect(matchingPDI(C('LRI L PDI'), 0)).toBe(2);
  });

  it('skips a nested isolate', () => {
    expect(matchingPDI(C('LRI RLI L PDI PDI'), 0)).toBe(4);
  });

  it('returns the length when there is no matching PDI', () => {
    expect(matchingPDI(C('LRI L L'), 0)).toBe(3);
  });

  it('is not confused by a PDI that precedes the initiator', () => {
    expect(matchingPDI(C('PDI LRI L PDI'), 1)).toBe(3);
  });
});
