import { describe, it, expect, vi } from 'vitest';
import { findConflicts, findScopedConflicts, formatConflict, reportRouteConflicts } from './conflicts';
import type { Tool } from '../../types';

function tool(id: string, bindings: unknown[]): Tool<unknown> {
  return { id, bindings } as unknown as Tool<unknown>;
}

const clickRect = (actionId = 'x') => ({ spec: { kind: 'click', target: 'empty' }, actionId });

describe('findConflicts', () => {
  it('returns nothing for a single tool', () => {
    expect(findConflicts([tool('a', [clickRect()])])).toEqual([]);
  });

  it('flags two tools claiming the same tuple', () => {
    const c = findConflicts([tool('a', [clickRect()]), tool('b', [clickRect()])]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds.sort()).toEqual(['a', 'b']);
    expect(c[0].gesture).toBe('click');
    expect(c[0].target).toBe('empty');
  });

  it('flags a three-way conflict', () => {
    const c = findConflicts([tool('a', [clickRect()]), tool('b', [clickRect()]), tool('c', [clickRect()])]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('does NOT flag different targets', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'selected-body' }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag different modifier requirements on the same target', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty', mods: { shift: true } }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty', mods: { alt: true } }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag a broad binding alongside a narrow one', () => {
    // Specificity ordering resolves this cleanly, and the untargeted one is
    // usually the intended fallback.
    const a = tool('a', [{ spec: { kind: 'click' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('separates conflicts by phase', () => {
    const a = tool('a', [{ spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'y' }]);
    const c = tool('c', [{ spec: { kind: 'wheel' }, actionId: 'z' }]);
    const conflicts = findConflicts([a, b, c]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].phase).toBe('engaged');
  });

  it('flags a tool that binds the same tuple twice', () => {
    // Newly possible: bindings are an array, where phase tables were objects
    // whose duplicate keys collapsed.
    const c = findConflicts([tool('a', [clickRect('x'), clickRect('y')])]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds).toEqual(['a', 'a']);
  });

  it('does NOT flag an any-phase binding against an initial-phase one', () => {
    // Regression: `phaseOf` used to collapse every non-'engaged' PhaseSpec to
    // 'initial', so these two bucketed together and reported a conflict that
    // isn't one — they fire in different phases.
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty', phase: 'initial' }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('flags two any-phase bindings on the same tuple', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty' }, actionId: 'y' }]);
    const c = findConflicts([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].phase).toBe('any');
  });
});

describe('formatConflict', () => {
  it('names the tuple in route grammar and lists the declaring tools', () => {
    const a = tool('a', [{ spec: { kind: 'click', target: 'empty', mods: { shift: true } }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'click', target: 'empty', mods: { shift: true } }, actionId: 'y' }]);
    const [c] = findConflicts([a, b]);
    expect(formatConflict(c)).toBe('[*] click => empty +shift — declared by a, b');
  });

  it('prints a phase-restricted conflict with its phase slot', () => {
    const a = tool('a', [{ spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'x' }]);
    const b = tool('b', [{ spec: { kind: 'wheel', phase: 'engaged' }, actionId: 'y' }]);
    const [c] = findConflicts([a, b]);
    expect(formatConflict(c)).toBe('[engaged] wheel — declared by a, b');
  });
});

describe('findConflicts — predicate targets', () => {
  it('does NOT flag two different `kindOf` predicates', () => {
    // The route grammar renders every predicate as one token, so bucketing on
    // the rendered target reported select's resize / rotate / move drags as a
    // three-way conflict. They are three different predicates.
    const a = tool('a', [
      { spec: { kind: 'drag', target: { kindOf: () => true } }, actionId: 'x' },
      { spec: { kind: 'drag', target: { kindOf: () => false } }, actionId: 'y' },
    ]);
    expect(findConflicts([a])).toEqual([]);
  });

  it('DOES flag the same predicate object bound twice', () => {
    const kindOf = () => true;
    const a = tool('a', [
      { spec: { kind: 'drag', target: { kindOf } }, actionId: 'x' },
    ]);
    const b = tool('b', [
      { spec: { kind: 'drag', target: { kindOf } }, actionId: 'y' },
    ]);
    // Distinct wrapper objects around the same predicate are still distinct
    // targets by identity; sharing the wrapper is what collides.
    const shared = { kindOf };
    const c = tool('c', [{ spec: { kind: 'drag', target: shared }, actionId: 'x' }]);
    const d = tool('d', [{ spec: { kind: 'drag', target: shared }, actionId: 'y' }]);
    expect(findConflicts([a, b])).toEqual([]);
    expect(findConflicts([c, d])).toHaveLength(1);
  });
});

describe('findScopedConflicts', () => {
  it('does NOT flag two registry tools — they take turns in the active slot', () => {
    // `rect` and `ellipse` both bind a bare drag. Only one can be active.
    const a = tool('rect', [{ spec: { kind: 'drag' }, actionId: 'insert' }]);
    const b = tool('ellipse', [{ spec: { kind: 'drag' }, actionId: 'insert' }]);
    expect(findScopedConflicts({ registry: [a, b] })).toEqual([]);
  });

  it('flags two ambient tools — all of them are live at once', () => {
    const a = tool('a', [clickRect('x')]);
    const b = tool('b', [clickRect('y')]);
    const found = findScopedConflicts({ registry: [], ambient: [a, b] });
    expect(found).toHaveLength(1);
    expect(found[0].toolIds).toEqual(['a', 'b']);
  });

  it('does NOT flag an ambient tool against a registry tool — scope decides', () => {
    // `matchSorted` walks hotkey > active > ambient and only sorts by
    // specificity within a scope, so active beating ambient is the design.
    const active = tool('select', [clickRect('x')]);
    const amb = tool('hud', [clickRect('y')]);
    expect(findScopedConflicts({ registry: [active], ambient: [amb] })).toEqual([]);
  });

  it('flags a tool that collides with itself, in either scope', () => {
    const selfish = tool('a', [clickRect('x'), clickRect('y')]);
    expect(findScopedConflicts({ registry: [selfish] })).toHaveLength(1);
    expect(findScopedConflicts({ registry: [], ambient: [selfish] })).toHaveLength(1);
  });

  it('flags two hotkey-capable registry tools — the stack holds both', () => {
    const a = { ...tool('a', [clickRect('x')]), def: { hotkey: 'space' } } as never;
    const b = { ...tool('b', [clickRect('y')]), def: { hotkey: 'alt' } } as never;
    expect(findScopedConflicts({ registry: [a, b] })).toHaveLength(1);
  });

  it('accepts the registry as a record, matching useTools', () => {
    const a = tool('a', [clickRect('x')]);
    const b = tool('b', [clickRect('y')]);
    expect(findScopedConflicts({ registry: { a, b } })).toEqual([]);
  });

  it('reports each conflict once even when several scopes surface it', () => {
    const selfish = tool('a', [clickRect('x'), clickRect('y')]);
    const other = tool('b', [{ spec: { kind: 'wheel' }, actionId: 'z' }]);
    const found = findScopedConflicts({ registry: [], ambient: [selfish, other] });
    // Found once as a self-collision and again in the ambient-wide pass.
    expect(found).toHaveLength(1);
  });
});

describe('reportRouteConflicts', () => {
  it('warns once per conflict and returns them', () => {
    const warn = vi.fn();
    const a = tool('a', [clickRect('x')]);
    const b = tool('b', [clickRect('y')]);
    const found = reportRouteConflicts({ registry: [], ambient: [a, b] }, warn);
    expect(found).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('route conflict');
    expect(warn.mock.calls[0][0]).toContain('[*] click => empty — declared by a, b');
  });

  it('stays silent on a conflict-free tool set', () => {
    const warn = vi.fn();
    expect(reportRouteConflicts({ registry: [tool('a', [clickRect()])] }, warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });
});
