import { describe, expect, it } from 'vitest';
import { evaluate, ALWAYS, NEVER, type Rule } from './rule';
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
