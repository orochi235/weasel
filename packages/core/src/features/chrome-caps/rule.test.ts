import { describe, expect, it } from 'vitest';
import { describeRule, evaluate, ALWAYS, NEVER, type Rule } from './rule';
import type { RuleCtx } from './ruleCtx';

function baseCtx(overrides: Partial<RuleCtx> = {}): RuleCtx {
  return {
    focused: true,
    selection: [],
    multiActive: false,
    modifiers: { alt: false, ctrl: false, meta: false, shift: false },
    action: { kind: null, id: null },
    hover: null,
    view: { x: 0, y: 0, scale: { x: 1, y: 1 } } as unknown as RuleCtx['view'],
    mode: 'normal',
    allowedCapabilities: new Set(['navigation', 'creates-selection']),
    ...overrides,
  };
}

describe('evaluate — constants', () => {
  it('ALWAYS is true in any context', () => {
    expect(evaluate(ALWAYS, baseCtx())).toBe(true);
  });
  it('NEVER is false in any context', () => {
    expect(evaluate(NEVER, baseCtx())).toBe(false);
  });
});

describe('evaluate — Selector keys', () => {
  it('selection.atLeast matches', () => {
    expect(evaluate({ selection: { atLeast: 1 } }, baseCtx({ selection: ['n1'] as never }))).toBe(true);
    expect(evaluate({ selection: { atLeast: 2 } }, baseCtx({ selection: ['n1'] as never }))).toBe(false);
  });
  it('selection.is exact match', () => {
    expect(evaluate({ selection: { is: 0 } }, baseCtx())).toBe(true);
    expect(evaluate({ selection: { is: 1 } }, baseCtx())).toBe(false);
  });
  it('selection.empty', () => {
    expect(evaluate({ selection: { empty: true } }, baseCtx())).toBe(true);
    expect(evaluate({ selection: { empty: true } }, baseCtx({ selection: ['n1'] as never }))).toBe(false);
  });
  it('mode exact match', () => {
    expect(evaluate({ mode: 'normal' }, baseCtx())).toBe(true);
    expect(evaluate({ mode: 'path-edit' }, baseCtx())).toBe(false);
  });
  it('mode { in: [...] }', () => {
    expect(evaluate({ mode: { in: ['normal', 'isolation'] } }, baseCtx())).toBe(true);
    expect(evaluate({ mode: { in: ['path-edit', 'text-edit'] } }, baseCtx())).toBe(false);
  });
  it('mode { not: x }', () => {
    expect(evaluate({ mode: { not: 'path-edit' } }, baseCtx())).toBe(true);
    expect(evaluate({ mode: { not: 'normal' } }, baseCtx())).toBe(false);
  });
  it('capability single', () => {
    expect(evaluate({ capability: 'creates-selection' }, baseCtx())).toBe(true);
    expect(evaluate({ capability: 'edits-anchors' }, baseCtx())).toBe(false);
  });
  it('capability array (AND)', () => {
    expect(evaluate({ capability: ['navigation', 'creates-selection'] }, baseCtx())).toBe(true);
    expect(evaluate({ capability: ['navigation', 'edits-anchors'] }, baseCtx())).toBe(false);
  });
  it('capability { in: [...] } (OR)', () => {
    expect(evaluate({ capability: { in: ['edits-anchors', 'creates-selection'] } }, baseCtx())).toBe(true);
    expect(evaluate({ capability: { in: ['edits-anchors', 'edits-text'] } }, baseCtx())).toBe(false);
  });
  it('capability { not: x }', () => {
    expect(evaluate({ capability: { not: 'edits-anchors' } }, baseCtx())).toBe(true);
    expect(evaluate({ capability: { not: 'navigation' } }, baseCtx())).toBe(false);
  });
  it('gesturing true/false', () => {
    expect(evaluate({ gesturing: false }, baseCtx())).toBe(true);
    expect(evaluate({ gesturing: true }, baseCtx())).toBe(false);
    expect(evaluate({ gesturing: true }, baseCtx({ action: { kind: 'move', id: 'm1' } }))).toBe(true);
  });
  it('actionIs', () => {
    expect(evaluate({ actionIs: 'move' }, baseCtx({ action: { kind: 'move', id: 'm1' } }))).toBe(true);
    expect(evaluate({ actionIs: 'resize' }, baseCtx({ action: { kind: 'move', id: 'm1' } }))).toBe(false);
  });
  it('focused', () => {
    expect(evaluate({ focused: true }, baseCtx({ focused: true }))).toBe(true);
    expect(evaluate({ focused: true }, baseCtx({ focused: false }))).toBe(false);
  });
  it('hovering / hoveringSelected', () => {
    const sel = ['n1'] as never;
    expect(evaluate({ hovering: true }, baseCtx({ hover: 'n1' as never }))).toBe(true);
    expect(evaluate({ hoveringSelected: true }, baseCtx({ hover: 'n1' as never, selection: sel }))).toBe(true);
    expect(evaluate({ hoveringSelected: true }, baseCtx({ hover: 'n2' as never, selection: sel }))).toBe(false);
  });
  it('zoomAtLeast', () => {
    const view = { x: 0, y: 0, scale: { x: 2, y: 2 } } as unknown as RuleCtx['view'];
    expect(evaluate({ zoomAtLeast: 1.5 }, baseCtx({ view }))).toBe(true);
    expect(evaluate({ zoomAtLeast: 3 }, baseCtx({ view }))).toBe(false);
  });
  it('multiple keys AND together', () => {
    const ctx = baseCtx({ selection: ['n1', 'n2'] as never, mode: 'normal' });
    expect(evaluate({ selection: { atLeast: 2 }, mode: 'normal' }, ctx)).toBe(true);
    expect(evaluate({ selection: { atLeast: 2 }, mode: 'path-edit' }, ctx)).toBe(false);
    expect(evaluate({ selection: { atLeast: 3 }, mode: 'normal' }, ctx)).toBe(false);
  });
});

describe('evaluate — combinators', () => {
  it('all empty is true', () => {
    expect(evaluate({ all: [] }, baseCtx())).toBe(true);
  });
  it('any empty is false', () => {
    expect(evaluate({ any: [] }, baseCtx())).toBe(false);
  });
  it('all short-circuits on false', () => {
    const ctx = baseCtx();
    expect(evaluate({ all: [{ mode: 'normal' }, { mode: 'path-edit' }] }, ctx)).toBe(false);
  });
  it('any short-circuits on true', () => {
    const ctx = baseCtx();
    expect(evaluate({ any: [{ mode: 'path-edit' }, { mode: 'normal' }] }, ctx)).toBe(true);
  });
  it('not inverts', () => {
    expect(evaluate({ not: { mode: 'path-edit' } }, baseCtx())).toBe(true);
    expect(evaluate({ not: { mode: 'normal' } }, baseCtx())).toBe(false);
  });
  it('when escape hatch runs the closure', () => {
    expect(evaluate({ when: (ctx) => ctx.mode === 'normal' }, baseCtx())).toBe(true);
    expect(evaluate({ when: (ctx) => ctx.mode === 'path-edit' }, baseCtx())).toBe(false);
  });
  it('nested combinators', () => {
    const r: Rule = { all: [{ mode: 'normal' }, { any: [{ selection: { atLeast: 1 } }, { focused: true }] }] };
    expect(evaluate(r, baseCtx())).toBe(true); // focused=true
    expect(evaluate(r, baseCtx({ focused: false, selection: ['n1'] as never }))).toBe(true);
    expect(evaluate(r, baseCtx({ focused: false }))).toBe(false);
  });
});

describe('describeRule', () => {
  it('renders a single-key selector as key:value', () => {
    expect(describeRule({ capability: 'edits-page' })).toBe('capability:edits-page');
    expect(describeRule({ mode: 'normal' })).toBe('mode:normal');
    expect(describeRule({ focused: true })).toBe('focused:true');
    expect(describeRule({ zoomAtLeast: 2 })).toBe('zoomAtLeast:2');
  });

  it('conjoins a multi-key selector, which is what it means', () => {
    expect(describeRule({ mode: 'normal', focused: true }))
      .toBe('mode:normal & focused:true');
  });

  it('renders the empty selector as the wildcard it evaluates to', () => {
    expect(describeRule({})).toBe('*');
    expect(evaluate({}, baseCtx())).toBe(true);
  });

  it('unwraps not / in selector values', () => {
    expect(describeRule({ mode: { not: 'path-edit' } })).toBe('mode:not(path-edit)');
    expect(describeRule({ mode: { in: ['normal', 'path-edit'] } }))
      .toBe('mode:in(normal+path-edit)');
    expect(describeRule({ capability: { not: 'edits-page' } }))
      .toBe('capability:not(edits-page)');
  });

  it('renders a capability array, which ANDs, as a join', () => {
    expect(describeRule({ capability: ['edits-page', 'navigation'] }))
      .toBe('capability:edits-page+navigation');
  });

  it('spells out the fields of a selection selector', () => {
    expect(describeRule({ selection: { empty: true } })).toBe('selection:empty=true');
    expect(describeRule({ selection: { atLeast: 2 } })).toBe('selection:atLeast=2');
    expect(describeRule({ selection: { is: 1, empty: false } }))
      .toBe('selection:is=1,empty=false');
  });

  it('renders all / any / not combinators', () => {
    expect(describeRule({ all: [{ mode: 'normal' }, { focused: true }] }))
      .toBe('all(mode:normal, focused:true)');
    expect(describeRule({ any: [{ mode: 'normal' }, { mode: 'path-edit' }] }))
      .toBe('any(mode:normal, mode:path-edit)');
    expect(describeRule({ not: { mode: 'path-edit' } })).toBe('not(mode:path-edit)');
  });

  it('renders the empty combinator constants', () => {
    expect(describeRule(ALWAYS)).toBe('all()');
    expect(describeRule(NEVER)).toBe('any()');
  });

  it('nests', () => {
    const r: Rule = {
      all: [{ mode: 'normal' }, { any: [{ selection: { atLeast: 1 } }, { not: { focused: true } }] }],
    };
    expect(describeRule(r))
      .toBe('all(mode:normal, any(selection:atLeast=1, not(focused:true)))');
  });

  it('names a when predicate, falling back to a glyph when anonymous', () => {
    function hasOpenPath(): boolean { return true; }
    expect(describeRule({ when: hasOpenPath })).toBe('when(hasOpenPath)');
    // An inline arrow assigned to nothing has no inferred name. The `.bind`
    // wrapper is the reliable way to get a genuinely anonymous function —
    // `{ when: () => true }` would infer the name `when` from the property.
    const anon = ((): boolean => true).bind(null);
    Object.defineProperty(anon, 'name', { value: '' });
    expect(describeRule({ when: anon })).toBe('when(ƒ)');
  });

  it('terminates on a cyclic rule instead of throwing, where JSON.stringify throws', () => {
    const cyclic = { not: null as unknown as Rule };
    cyclic.not = cyclic as unknown as Rule;
    expect(() => JSON.stringify(cyclic)).toThrow();
    expect(() => describeRule(cyclic as Rule)).not.toThrow();
    expect(describeRule(cyclic as Rule)).toContain('…');
  });
});

describe('device selectors', () => {
  const coarse = baseCtx({
    device: { coarsePointer: true, canHover: false, dpr: 3, targetScale: 1.75 },
  });

  const fine = baseCtx({
    device: { coarsePointer: false, canHover: true, dpr: 1, targetScale: 1 },
  });

  it('coarsePointer matches a coarse device', () => {
    expect(evaluate({ coarsePointer: true }, coarse)).toBe(true);
    expect(evaluate({ coarsePointer: true }, fine)).toBe(false);
  });

  it('canHover matches a hover-capable device', () => {
    expect(evaluate({ canHover: true }, fine)).toBe(true);
    expect(evaluate({ canHover: true }, coarse)).toBe(false);
  });

  it('absent device is treated as fine-pointer and hover-capable', () => {
    expect(evaluate({ coarsePointer: false }, baseCtx())).toBe(true);
    expect(evaluate({ canHover: true }, baseCtx())).toBe(true);
  });

  it('describeRule renders the new selectors', () => {
    expect(describeRule({ coarsePointer: true })).toBe('coarsePointer:true');
  });
});
