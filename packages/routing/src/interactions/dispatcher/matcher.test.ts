import { describe, it, expect } from 'vitest';
import {
  matchBest, matchSorted, matchTarget, specificity, targetConsultsAffordance,
  type InputEvent, type ScopedBinding,
} from './matcher';
import type { GestureBinding } from '../actions/binding';
import type { GestureSpec, TargetSpec } from '@weasel-js/gestures';

const noMods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };
// Default wheel event data fields (matcher only reads mods; these are pass-through).
const noWheelData = { deltaX: 0, deltaY: 0, clientX: 0, clientY: 0 };

describe('matchBest (precedence)', () => {
  function binding(spec: any, actionId = 'x'): GestureBinding {
    return { spec, actionId };
  }

  it('returns null when no bindings match', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    expect(matchBest(e, [{ binding: binding({ kind: 'key', key: 'b' }), scope: 'ambient', ownerToolId: null }], false)).toBeNull();
  });

  it('returns null for empty bindings list', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    expect(matchBest(e, [], false)).toBeNull();
  });

  it('returns a single matching binding', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const b = binding({ kind: 'key', key: 'a' }, 'select-all');
    const result = matchBest(e, [{ binding: b, scope: 'ambient', ownerToolId: null }], false);
    expect(result?.binding.actionId).toBe('select-all');
    expect(result?.scope).toBe('ambient');
  });

  it('precedence: hotkey beats active beats ambient', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'ambient-a'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'key', key: 'a' }, 'active-a'), scope: 'active', ownerToolId: 'test-tool' },
      { binding: binding({ kind: 'key', key: 'a' }, 'hotkey-a'), scope: 'hotkey', ownerToolId: 'test-tool' },
    ];
    const result = matchBest(e, bs, false);
    expect(result?.binding.actionId).toBe('hotkey-a');
  });

  it('within scope, first-declared wins', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'first'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'key', key: 'a' }, 'second'), scope: 'ambient', ownerToolId: null },
    ];
    const result = matchBest(e, bs, false);
    expect(result?.binding.actionId).toBe('first');
  });

  it('active scope wins over ambient even when both match', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'ambient-a'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'key', key: 'a' }, 'active-a'), scope: 'active', ownerToolId: 'test-tool' },
    ];
    expect(matchBest(e, bs, false)?.binding.actionId).toBe('active-a');
  });

  it('hotkey scope wins over active', () => {
    const e: InputEvent = { kind: 'key', key: 'a', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'a' }, 'active-a'), scope: 'active', ownerToolId: 'test-tool' },
      { binding: binding({ kind: 'key', key: 'a' }, 'hotkey-a'), scope: 'hotkey', ownerToolId: 'test-tool' },
    ];
    expect(matchBest(e, bs, false)?.binding.actionId).toBe('hotkey-a');
  });

  it('result includes correct scope', () => {
    const e: InputEvent = { kind: 'key', key: 'z', ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'key', key: 'z' }, 'z-active'), scope: 'active', ownerToolId: 'test-tool' },
    ];
    const result = matchBest(e, bs, false);
    expect(result?.scope).toBe('active');
  });

  it('wheel gesture routed correctly through matchBest', () => {
    const e: InputEvent = { kind: 'wheel', ...noMods, ...noWheelData, ctrlKey: true };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'wheel', mods: { ctrl: true } }, 'zoom'), scope: 'ambient', ownerToolId: null },
    ];
    expect(matchBest(e, bs, false)?.binding.actionId).toBe('zoom');
  });
});

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

  describe('undeclared target forms', () => {
    // The three sites that enumerate the forms take `TargetSpec`, not
    // `unknown`, and switch on `parseTargetSpec`'s discriminated result. The
    // `@ts-expect-error`s below fail typecheck if any of them ever widens
    // back to a shape that swallows an unknown form silently.
    it('are a type error at each of the three sites, and no-match at runtime', () => {
      // @ts-expect-error 'layer:hud' is not a TargetSpec form.
      expect(specificity({ kind: 'click', target: 'layer:hud' })).toEqual([1, 0, 0, 1]);
      // @ts-expect-error same, at the exclusive-claim filter.
      expect(targetConsultsAffordance('layer:hud')).toBe(false);
      // @ts-expect-error same, at the matcher in @weasel-js/gestures.
      expect(matchTarget({ kind: 'layer:hud' }, 'layer:hud', 'empty', 'text')).toBe(false);
    });
  });
});

describe('matchSorted (specificity ordering)', () => {
  function binding(spec: any, actionId = 'x'): GestureBinding {
    return { spec, actionId };
  }

  it('target predicate beats bare regardless of registration order', () => {
    const anchorPredicate = (hit: unknown): boolean =>
      typeof hit === 'object' && hit !== null && (hit as { kind?: string }).kind === 'anchor:0';
    const e: InputEvent = {
      kind: 'pointerdown',
      x: 0, y: 0, ...noMods,
      affordance: { kind: 'anchor:0' },
    };
    const bs: ScopedBinding[] = [
      // BARE binding registered FIRST.
      { binding: binding({ kind: 'drag' }, 'move'), scope: 'ambient', ownerToolId: null },
      // Targeted binding registered SECOND — should still win.
      {
        binding: binding({ kind: 'drag', target: { kindOf: anchorPredicate } }, 'editAnchors'),
        scope: 'ambient',
        ownerToolId: null,
      },
    ];
    const sorted = matchSorted(e, bs, false);
    expect(sorted.map((m) => m.binding.actionId)).toEqual(['editAnchors', 'move']);
  });

  it('equal-specificity bindings retain registration order', () => {
    const e: InputEvent = { kind: 'pointerdown', x: 0, y: 0, ...noMods };
    const bs: ScopedBinding[] = [
      { binding: binding({ kind: 'drag' }, 'a'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'drag' }, 'b'), scope: 'ambient', ownerToolId: null },
      { binding: binding({ kind: 'drag' }, 'c'), scope: 'ambient', ownerToolId: null },
    ];
    const sorted = matchSorted(e, bs, false);
    expect(sorted.map((m) => m.binding.actionId)).toEqual(['a', 'b', 'c']);
  });

  it('scope priority dominates specificity (ambient bare beats active targeted only in active scope; hotkey wins overall)', () => {
    // Three bindings, increasing specificity but decreasing scope priority.
    // Hotkey bare still beats active targeted because scope wins.
    const e: InputEvent = {
      kind: 'pointerdown',
      x: 0, y: 0, ...noMods,
      affordance: { kind: 'anchor:0' },
    };
    const bs: ScopedBinding[] = [
      {
        binding: binding({ kind: 'drag', target: { kindOf: () => true } }, 'ambient-targeted'),
        scope: 'ambient',
        ownerToolId: null,
      },
      {
        binding: binding({ kind: 'drag', target: { kindOf: () => true } }, 'active-targeted'),
        scope: 'active',
        ownerToolId: 't',
      },
      { binding: binding({ kind: 'drag' }, 'hotkey-bare'), scope: 'hotkey', ownerToolId: 't' },
    ];
    const sorted = matchSorted(e, bs, false);
    expect(sorted.map((m) => m.binding.actionId)).toEqual([
      'hotkey-bare',
      'active-targeted',
      'ambient-targeted',
    ]);
  });

  it('MIME-typed drop spec beats untyped catch-all in the same scope regardless of registration order', () => {
    const e: InputEvent = {
      kind: 'drop',
      items: [{ kind: 'string', mime: 'text/csv', text: 'a,b' }],
      x: 0, y: 0, ...noMods,
    };
    const bs: ScopedBinding[] = [
      // Untyped catch-all registered FIRST (the kit's ambient ingest binding).
      { binding: binding({ kind: 'drop' }, 'ingest'), scope: 'ambient', ownerToolId: null },
      // Typed consumer binding registered SECOND — should still sort first.
      { binding: binding({ kind: 'drop', types: ['text/csv'] }, 'csv-import'), scope: 'ambient', ownerToolId: null },
    ];
    const sorted = matchSorted(e, bs, false);
    expect(sorted.map((m) => m.binding.actionId)).toEqual(['csv-import', 'ingest']);
  });
});
