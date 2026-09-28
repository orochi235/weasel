import { describe, it, expect } from 'vitest';
import { specificity } from './specificity';
import type { GestureSpec, TargetSpec } from './spec';

describe('specificity (tuple shape)', () => {
  it('bare kind: drag → [0, 0, 0, 1]', () => {
    expect(specificity({ kind: 'drag' } as GestureSpec)).toEqual([0, 0, 0, 1]);
  });

  it('drag with target predicate → [1, 0, 0, 1]', () => {
    const spec: GestureSpec = {
      kind: 'drag',
      target: { kindOf: () => true },
    };
    expect(specificity(spec)).toEqual([1, 0, 0, 1]);
  });

  it("drag with one required modifier → [0, 1, 0, 1]", () => {
    expect(specificity({ kind: 'drag', mods: { shift: true } } as GestureSpec))
      .toEqual([0, 1, 0, 1]);
  });

  it("mods: { shift: 'optional' } does NOT count toward specificity", () => {
    expect(specificity({ kind: 'drag', mods: { shift: 'optional' } } as GestureSpec))
      .toEqual([0, 0, 0, 1]);
  });

  it('two required modifiers stack → [0, 2, 0, 1]', () => {
    expect(specificity({
      kind: 'key',
      key: 'g',
      mods: { mod: true, shift: true },
    } as GestureSpec)).toEqual([0, 2, 0, 1]);
  });

  it('bare-keyword phase desugars to a concrete `&` atom → [0, 0, 2, 1]', () => {
    expect(specificity({ kind: 'drag', phase: 'engaged' } as GestureSpec))
      .toEqual([0, 0, 2, 1]);
  });

  it('all dimensions stack → [1, 2, 2, 1]', () => {
    const spec: GestureSpec = {
      kind: 'drag',
      target: { kindOf: () => true },
      mods: { mod: true, shift: true },
      phase: 'engaged',
    };
    expect(specificity(spec)).toEqual([1, 2, 2, 1]);
  });

  describe('graduated phase specificity', () => {
    const phaseRank = (phase: GestureSpec['phase']): number =>
      specificity({ kind: 'drag', phase } as GestureSpec)[2];

    it('both axes concrete outranks a wildcarded channel', () => {
      expect(phaseRank([{ channel: 'pen', phase: 'engaged' }])).toBe(2);
      expect(phaseRank([{ channel: '*', phase: 'engaged' }])).toBe(1);
    });

    it('a wildcarded phase costs the same axis as a wildcarded channel', () => {
      expect(phaseRank([{ channel: '&', phase: '*' }])).toBe(1);
    });

    it('`*:*` ranks the same as declaring no phase at all', () => {
      expect(phaseRank([{ channel: '*', phase: '*' }])).toBe(0);
      expect(phaseRank(undefined)).toBe(0);
    });

    it('an atom list is as broad as its broadest atom', () => {
      expect(phaseRank([
        { channel: '&', phase: 'engaged' },
        { channel: '*', phase: 'initial' },
      ])).toBe(1);
    });

    it("the kit's own ambient actions keep the score they had", () => {
      // escape / delete / anchorEditing / cancelGesture — the compat claim in
      // `phaseRank`'s doc comment. Scoring them 2 would have let a spec that
      // narrows almost nothing tie a precise `&:engaged`.
      expect(phaseRank([{ channel: '*', phase: 'initial' }])).toBe(1);
      expect(phaseRank([{ channel: '*', phase: 'engaged' }])).toBe(1);
    });
  });

  describe('graduated target specificity', () => {
    const targetRank = (target: TargetSpec): number =>
      specificity({ kind: 'click', target } as GestureSpec)[0];

    it('a body class and a predicate rank the same as before', () => {
      expect(targetRank('selected-body')).toBe(1);
      expect(targetRank({ kindOf: () => true })).toBe(1);
    });

    it('a node kind outranks a bare body class', () => {
      expect(targetRank('kind:text')).toBeGreaterThan(targetRank('selected-body'));
    });

    it('a node kind plus selection outranks the kind alone', () => {
      expect(targetRank('kind:text:selected')).toBeGreaterThan(targetRank('kind:text'));
    });

    it('an exact affordance outranks a bare body class', () => {
      expect(targetRank('affordance:rotate-handle')).toBeGreaterThan(targetRank('empty'));
    });
  });
});
