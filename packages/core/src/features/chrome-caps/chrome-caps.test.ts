import { describe, it, expect } from 'vitest';
import { asNodeId, type NodeId } from '../../core/scene/types';
import type { ChromeCtx, Condition, RuleCtx } from './types';
import {
  when, and, or, not, always, never,
  focused, gesturing, resizable, actionIs,
  selectionEmpty, selectionIs, selectionAtLeast, multiActive,
  hovering, hoveringSelected,
  modifierHeld, zoomAtLeast,
} from './conditions';
import { defaultVisibilityRules } from './defaults';
import { resolveVisibility } from './resolve';
import { byId, DEFAULT_MODES, IMPLICIT_TAGS, type CapabilityTag } from '@weasel-js/modes';

/** Capabilities the named mode actually allows, per the default preset.
 *  The fixture derives these rather than taking a hand-written set: a ctx
 *  claiming `mode: 'path-edit'` while allowing everything (or claiming
 *  `mode: 'normal'` while allowing nothing) can't exercise a capability rule
 *  honestly, and the defaults table is written in capabilities. */
function capsFor(mode: string): ReadonlySet<CapabilityTag> {
  // Consumer-defined mode ids aren't in the preset; those tests pass an
  // explicit `allowedCapabilities` and never reach this.
  const known = DEFAULT_MODES.some((m) => m.id === mode);
  const allows = known ? byId(mode).allows : [];
  return new Set<CapabilityTag>([...allows, ...IMPLICIT_TAGS]);
}

function ctx(over: Partial<RuleCtx> = {}): RuleCtx {
  const mode = over.mode ?? 'normal';
  return {
    focused: false,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    action: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    mode,
    allowedCapabilities: capsFor(mode),
    ...over,
  };
}

const NID = (s: string): NodeId => asNodeId(s);

describe('chrome-caps / atoms', () => {
  it('focused', () => {
    expect(focused(ctx({ focused: true }))).toBe(true);
    expect(focused(ctx({ focused: false }))).toBe(false);
  });

  it('gesturing / actionIs', () => {
    expect(gesturing(ctx())).toBe(false);
    expect(gesturing(ctx({ action: { kind: 'move', id: 'g1' } }))).toBe(true);
    expect(actionIs('move')(ctx({ action: { kind: 'move', id: 'g1' } }))).toBe(true);
    expect(actionIs('marquee')(ctx({ action: { kind: 'move', id: 'g1' } }))).toBe(false);
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

  it('resizable — absent flag treated as resizable (back-compat)', () => {
    expect(resizable(ctx())).toBe(true); // selectionResizable undefined
    expect(resizable(ctx({ selectionResizable: true }))).toBe(true);
    expect(resizable(ctx({ selectionResizable: false }))).toBe(false);
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
      action: { kind: 'move', id: 'g1' },
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
    const gest = ctx({ selection: [NID('a')], focused: true, action: { kind: 'move', id: 'g1' } });
    expect(resolveVisibility(undefined, gest)('selection.resize-handles')).toBe(false);
  });

  it('selection.resize-handles also visible in multi-mode (union-bounds resize)', () => {
    const multi = ctx({ selection: [NID('a'), NID('b')], multiActive: true });
    expect(resolveVisibility(undefined, multi)('selection.resize-handles')).toBe(true);
  });

  it('selection.resize-handles hidden when selection is not resizable', () => {
    // Default (undefined flag) → handles show; explicit false → hidden.
    const ok = ctx({ selection: [NID('a')] });
    expect(resolveVisibility(undefined, ok)('selection.resize-handles')).toBe(true);
    const notResizable = ctx({ selection: [NID('a')], selectionResizable: false });
    expect(resolveVisibility(undefined, notResizable)('selection.resize-handles')).toBe(false);
    // outline + (focused) rotation handle remain unaffected by resizability.
    expect(resolveVisibility(undefined, notResizable)('selection.outline')).toBe(true);
  });

  it('selection.rotation-handle needs focus + at least one selection + idle', () => {
    const f = (over: Partial<ChromeCtx>) =>
      resolveVisibility(undefined, ctx({ selection: [NID('a')], focused: true, ...over }))(
        'selection.rotation-handle',
      );
    expect(f({})).toBe(true);
    expect(f({ focused: false })).toBe(false);
    // Multi-selection: union-pivot rotation. The rotation action's
    // `useUnionPivot: ids.length > 1` branch drives it.
    expect(f({ selection: [NID('a'), NID('b')] })).toBe(true);
    expect(f({ action: { kind: 'move', id: 'g1' } })).toBe(false);
  });

  it('action.marquee only visible during marquee action', () => {
    const f = (a: { kind: string | null; id: string | null }) =>
      resolveVisibility(undefined, ctx({ action: a }))('action.marquee');
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
      'action.lasso',
      'action.marquee',
      'action.move-ghosts',
      'path-edit.anchors',
      'path-edit.overlay',
      'selection.outline',
      'selection.resize-handles',
      'selection.rotation-handle',
      'snap.guides',
    ]);
  });
});

describe('mode-gated defaults', () => {
  const baseCtx = ctx;

  it('selection.outline is off in path-edit mode even with selection', () => {
    const c = baseCtx({ selection: [NID('n1')], mode: 'path-edit' });
    const isVisible = resolveVisibility(undefined, c);
    expect(isVisible('selection.outline')).toBe(false);
  });

  it('selection.resize-handles is off in path-edit mode', () => {
    const c = baseCtx({ selection: [NID('n1')], mode: 'path-edit' });
    const isVisible = resolveVisibility(undefined, c);
    expect(isVisible('selection.resize-handles')).toBe(false);
  });

  it('selection.rotation-handle is off in path-edit mode', () => {
    const c = baseCtx({ selection: [NID('n1')], focused: true, mode: 'path-edit' });
    const isVisible = resolveVisibility(undefined, c);
    expect(isVisible('selection.rotation-handle')).toBe(false);
  });

  it('selection chrome is ON in normal mode', () => {
    const c = baseCtx({ selection: [NID('n1')], focused: true, mode: 'normal' });
    const isVisible = resolveVisibility(undefined, c);
    expect(isVisible('selection.outline')).toBe(true);
    expect(isVisible('selection.resize-handles')).toBe(true);
    expect(isVisible('selection.rotation-handle')).toBe(true);
  });

  // The point of gating on `transforms-selection` rather than
  // `mode: { not: 'path-edit' }`: modes that forbid transforms get the right
  // answer without anyone editing this table. Grabbing a resize handle in
  // crop or text-edit could only ever be a no-op, so it shouldn't be offered.
  it.each([
    ['text-edit', false],
    ['crop', false],
    ['free-transform', true],
    ['isolation', true],
  ] as const)('transform chrome in %s mode follows the capability, not a mode id', (mode, shown) => {
    const c = baseCtx({ selection: [NID('n1')], focused: true, mode });
    const isVisible = resolveVisibility(undefined, c);
    expect(isVisible('selection.resize-handles')).toBe(shown);
    expect(isVisible('selection.rotation-handle')).toBe(shown);
  });

  // The outline is suppressed by *anchor editing owning the visuals*, not by
  // the literal id 'path-edit' — so a future anchor-editing mode inherits the
  // behavior for free.
  it('selection.outline follows edits-anchors, not the path-edit id', () => {
    const anchorish = baseCtx({
      selection: [NID('n1')],
      mode: 'some-future-anchor-mode',
      allowedCapabilities: new Set<CapabilityTag>(['edits-anchors']),
    });
    expect(resolveVisibility(undefined, anchorish)('selection.outline')).toBe(false);
  });

  // Regression guard: a consumer that never wired `getActiveMode` must not
  // lose its chrome. `resolveVisibility` fills the legacy ChromeCtx shape
  // with normal-mode capabilities, so capability rules stay true.
  it('legacy ChromeCtx (no mode wired) still shows transform chrome', () => {
    const legacy: ChromeCtx = {
      focused: true,
      selection: [NID('n1')],
      multiActive: false,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      action: { kind: null, id: null },
      hover: null,
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
    };
    const isVisible = resolveVisibility(undefined, legacy);
    expect(isVisible('selection.outline')).toBe(true);
    expect(isVisible('selection.resize-handles')).toBe(true);
    expect(isVisible('selection.rotation-handle')).toBe(true);
  });

  it('path-edit.anchors is ON only in path-edit mode', () => {
    expect(resolveVisibility(undefined, baseCtx({ mode: 'path-edit' }))('path-edit.anchors')).toBe(true);
    expect(resolveVisibility(undefined, baseCtx({ mode: 'normal' }))('path-edit.anchors')).toBe(false);
  });

  it('path-edit.overlay is ON only in path-edit mode', () => {
    expect(resolveVisibility(undefined, baseCtx({ mode: 'path-edit' }))('path-edit.overlay')).toBe(true);
    expect(resolveVisibility(undefined, baseCtx({ mode: 'normal' }))('path-edit.overlay')).toBe(false);
  });
});
