import { describe, it, expect } from 'vitest';
import { asNodeId, type NodeId } from '../../core/scene/types';
import type { ChromeCtx, Condition } from './types';
import {
  when, and, or, not, always, never,
  focused, gesturing, gestureIs,
  selectionEmpty, selectionIs, selectionAtLeast, multiActive,
  hovering, hoveringSelected, suppressed,
  modifierHeld, zoomAtLeast,
} from './conditions';
import { defaultVisibilityRules } from './defaults';
import { resolveVisibility } from './resolve';

function ctx(over: Partial<ChromeCtx> = {}): ChromeCtx {
  return {
    focused: false,
    selection: [],
    multiActive: false,
    suppressedIds: new Set(),
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    gesture: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    ...over,
  };
}

const NID = (s: string): NodeId => asNodeId(s);

describe('chrome-caps / atoms', () => {
  it('focused', () => {
    expect(focused(ctx({ focused: true }))).toBe(true);
    expect(focused(ctx({ focused: false }))).toBe(false);
  });

  it('gesturing / gestureIs', () => {
    expect(gesturing(ctx())).toBe(false);
    expect(gesturing(ctx({ gesture: { kind: 'move', id: 'g1' } }))).toBe(true);
    expect(gestureIs('move')(ctx({ gesture: { kind: 'move', id: 'g1' } }))).toBe(true);
    expect(gestureIs('marquee')(ctx({ gesture: { kind: 'move', id: 'g1' } }))).toBe(false);
  });

  it('selection atoms', () => {
    expect(selectionEmpty(ctx())).toBe(true);
    expect(selectionEmpty(ctx({ selection: [NID('a')] }))).toBe(false);
    expect(selectionIs(1)(ctx({ selection: [NID('a')] }))).toBe(true);
    expect(selectionIs(2)(ctx({ selection: [NID('a')] }))).toBe(false);
    expect(selectionAtLeast(1)(ctx({ selection: [NID('a')] }))).toBe(true);
    expect(selectionAtLeast(1)(ctx({ selection: [NID('a'), NID('b')] }))).toBe(true);
    expect(selectionAtLeast(2)(ctx({ selection: [NID('a')] }))).toBe(false);
  });

  it('multiActive', () => {
    expect(multiActive(ctx({ multiActive: true }))).toBe(true);
    expect(multiActive(ctx({ multiActive: false }))).toBe(false);
  });

  it('hover atoms', () => {
    expect(hovering(ctx())).toBe(false);
    expect(hovering(ctx({ hover: NID('a') }))).toBe(true);
    expect(hoveringSelected(ctx({ hover: NID('a'), selection: [NID('a')] }))).toBe(true);
    expect(hoveringSelected(ctx({ hover: NID('a'), selection: [NID('b')] }))).toBe(false);
  });

  it('suppressed', () => {
    expect(suppressed('foo')(ctx({ suppressedIds: new Set(['foo']) }))).toBe(true);
    expect(suppressed('foo')(ctx({ suppressedIds: new Set(['bar']) }))).toBe(false);
  });

  it('modifierHeld', () => {
    const m = ctx({ modifiers: { alt: false, shift: true, meta: false, ctrl: false } });
    expect(modifierHeld('shift')(m)).toBe(true);
    expect(modifierHeld('alt')(m)).toBe(false);
  });

  it('zoomAtLeast (uniform)', () => {
    expect(zoomAtLeast(1)(ctx())).toBe(true);
    expect(zoomAtLeast(2)(ctx())).toBe(false);
    expect(zoomAtLeast(0.5)(ctx({ view: { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } } }))).toBe(true);
  });

  it('zoomAtLeast (non-uniform uses geometric mean)', () => {
    // sqrt(4 * 1) = 2
    expect(zoomAtLeast(2)(ctx({ view: { x: 0, y: 0, scale: { x: 4, y: 1 } } }))).toBe(true);
    expect(zoomAtLeast(2.5)(ctx({ view: { x: 0, y: 0, scale: { x: 4, y: 1 } } }))).toBe(false);
  });

  it('always / never', () => {
    expect(always(ctx())).toBe(true);
    expect(never(ctx())).toBe(false);
  });
});

describe('chrome-caps / fluent chains', () => {
  it('.and / .or / .andNot / .orNot', () => {
    const T = always; const F = never;
    expect(T.and(T)(ctx())).toBe(true);
    expect(T.and(F)(ctx())).toBe(false);
    expect(F.or(T)(ctx())).toBe(true);
    expect(F.or(F)(ctx())).toBe(false);
    expect(T.andNot(F)(ctx())).toBe(true);
    expect(T.andNot(T)(ctx())).toBe(false);
    expect(F.orNot(F)(ctx())).toBe(true);
    expect(T.orNot(T)(ctx())).toBe(true); // T || !T = T
  });

  it('chain semantics are strict left-to-right (no precedence)', () => {
    // a.or(b).and(c) === (a || b) && c  — NOT a || (b && c)
    // With a=true, b=false, c=false: standard precedence gives true; LTR gives false.
    const A: Condition = always;
    const B: Condition = never;
    const C: Condition = never;
    expect(A.or(B).and(C)(ctx())).toBe(false);  // (T || F) && F  = F
    expect(A.or(B.and(C))(ctx())).toBe(true);   // T || (F && F)  = T  (explicit grouping)
  });

  it('top-level and / or / not helpers', () => {
    expect(and(always, always, always)(ctx())).toBe(true);
    expect(and(always, never, always)(ctx())).toBe(false);
    expect(or(never, never, always)(ctx())).toBe(true);
    expect(or(never, never, never)(ctx())).toBe(false);
    expect(not(never)(ctx())).toBe(true);
  });

  it('when() is an alias for cond()', () => {
    const c = when((ctx) => ctx.selection.length === 3);
    expect(c(ctx({ selection: [NID('a'), NID('b'), NID('c')] }))).toBe(true);
    expect(typeof c.and).toBe('function'); // gets the fluent surface
  });

  it('composed atoms — example default rule', () => {
    const rule = selectionIs(1).and(focused).andNot(gesturing);
    expect(rule(ctx({ selection: [NID('a')], focused: true }))).toBe(true);
    expect(rule(ctx({ selection: [NID('a')], focused: false }))).toBe(false);
    expect(rule(ctx({ selection: [NID('a'), NID('b')], focused: true }))).toBe(false);
    expect(rule(ctx({
      selection: [NID('a')],
      focused: true,
      gesture: { kind: 'move', id: 'g1' },
    }))).toBe(false);
  });
});

describe('chrome-caps / defaults table', () => {
  it('selection.outline visible when something is selected', () => {
    const f = resolveVisibility(undefined, ctx({ selection: [NID('a')] }));
    expect(f('selection.outline')).toBe(true);
    const empty = resolveVisibility(undefined, ctx());
    expect(empty('selection.outline')).toBe(false);
  });

  it('selection.resize-handles hidden during gesture', () => {
    const sel = ctx({ selection: [NID('a')], focused: true });
    expect(resolveVisibility(undefined, sel)('selection.resize-handles')).toBe(true);
    const gest = ctx({ selection: [NID('a')], focused: true, gesture: { kind: 'move', id: 'g1' } });
    expect(resolveVisibility(undefined, gest)('selection.resize-handles')).toBe(false);
  });

  it('selection.resize-handles also visible in multi-mode (union-bounds resize)', () => {
    const multi = ctx({ selection: [NID('a'), NID('b')], multiActive: true });
    expect(resolveVisibility(undefined, multi)('selection.resize-handles')).toBe(true);
  });

  it('selection.rotation-handle needs focus + single selection + idle', () => {
    const f = (over: Partial<ChromeCtx>) =>
      resolveVisibility(undefined, ctx({ selection: [NID('a')], focused: true, ...over }))(
        'selection.rotation-handle',
      );
    expect(f({})).toBe(true);
    expect(f({ focused: false })).toBe(false);
    expect(f({ selection: [NID('a'), NID('b')] })).toBe(false);
    expect(f({ gesture: { kind: 'move', id: 'g1' } })).toBe(false);
  });

  it('gesture.marquee only visible during marquee gesture', () => {
    const f = (g: { kind: string | null; id: string | null }) =>
      resolveVisibility(undefined, ctx({ gesture: g }))('gesture.marquee');
    expect(f({ kind: null, id: null })).toBe(false);
    expect(f({ kind: 'marquee', id: 'g1' })).toBe(true);
    expect(f({ kind: 'move', id: 'g1' })).toBe(false);
  });

  it('unregistered id falls through to always', () => {
    const f = resolveVisibility(undefined, ctx());
    expect(f('something.not.in.defaults')).toBe(true);
  });

  it('consumer override beats default', () => {
    const f = resolveVisibility(
      { 'selection.outline': never },
      ctx({ selection: [NID('a')] }),
    );
    expect(f('selection.outline')).toBe(false);
  });

  it('consumer can register new ids that defaults do not mention', () => {
    const f = resolveVisibility(
      { 'my-custom-chrome': always },
      ctx(),
    );
    expect(f('my-custom-chrome')).toBe(true);
  });

  it('defaults table snapshot — keys', () => {
    expect(Object.keys(defaultVisibilityRules).sort()).toEqual([
      'gesture.lasso',
      'gesture.marquee',
      'gesture.move-ghosts',
      'selection.outline',
      'selection.resize-handles',
      'selection.rotation-handle',
      'snap.guides',
    ]);
  });
});
