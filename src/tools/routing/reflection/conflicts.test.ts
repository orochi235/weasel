import { describe, it, expect } from 'vitest';
import { findConflicts, type Conflict } from './conflicts';
import { apply } from '../result';
import { mods } from '../modifiers';
import type { ToolDef } from '../types';

const noOp = () => apply<unknown>([]);

describe('findConflicts', () => {
  it('returns empty array when no overlap', () => {
    const a: ToolDef<unknown> = { id: 'a', initial: { click: { 'rect': noOp } } };
    const b: ToolDef<unknown> = { id: 'b', initial: { click: { 'text': noOp } } };
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('flags exact-tuple overlap', () => {
    const a: ToolDef<unknown> = { id: 'a', initial: { click: { 'rect': noOp } } };
    const b: ToolDef<unknown> = { id: 'b', initial: { click: { 'rect': noOp } } };
    const c = findConflicts([a, b]);
    expect(c).toEqual<Conflict[]>([{
      phase: 'initial',
      gesture: 'click',
      arg: undefined,
      target: 'rect',
      modifiers: 'default',
      toolIds: ['a', 'b'],
    }]);
  });

  it('flags overlap on a specific modifier sub-key', () => {
    const a: ToolDef<unknown> = {
      id: 'a',
      initial: { click: { 'rect': { [mods('shift')]: noOp } } },
    };
    const b: ToolDef<unknown> = {
      id: 'b',
      initial: { click: { 'rect': { [mods('shift')]: noOp } } },
    };
    const c = findConflicts([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].modifiers).toBe('shift');
  });

  it('does NOT flag wildcard-vs-specific overlap (cascading-fallback is expected)', () => {
    const a: ToolDef<unknown> = { id: 'a', initial: { click: { '*':    noOp } } };
    const b: ToolDef<unknown> = { id: 'b', initial: { click: { 'rect': noOp } } };
    // The lookup engine cleanly resolves: rect → 'rect' on b, anything-else → '*' on a.
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag different modifier combos on the same target', () => {
    const a: ToolDef<unknown> = {
      id: 'a',
      initial: { click: { 'rect': { [mods('shift')]: noOp } } },
    };
    const b: ToolDef<unknown> = {
      id: 'b',
      initial: { click: { 'rect': { [mods('alt')]: noOp } } },
    };
    expect(findConflicts([a, b])).toEqual([]);
  });

  it('does NOT flag same-tool self-overlap (impossible by construction — single key)', () => {
    // A ToolDef literal can't declare the same target key twice — JS object literal
    // semantics deduplicate. So self-overlap can only happen across two tools.
    // This test documents the invariant.
    const a: ToolDef<unknown> = { id: 'a', initial: { click: { 'rect': noOp } } };
    expect(findConflicts([a])).toEqual([]);
  });

  it('flags three-way conflict (>= 2 tools claim same tuple)', () => {
    const mk = (id: string): ToolDef<unknown> => ({ id, initial: { click: { 'rect': noOp } } });
    const c = findConflicts([mk('a'), mk('b'), mk('c')]);
    expect(c).toHaveLength(1);
    expect(c[0].toolIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('flags conflicts in engaged phase independently of initial phase', () => {
    const a: ToolDef<unknown> = { id: 'a', engaged: { keyDown: { 'Escape': noOp } }, initial: {} };
    const b: ToolDef<unknown> = { id: 'b', engaged: { keyDown: { 'Escape': noOp } }, initial: {} };
    const c = findConflicts([a, b]);
    expect(c).toHaveLength(1);
    expect(c[0].phase).toBe('engaged');
    expect(c[0].gesture).toBe('keyDown');
    expect(c[0].arg).toBe('Escape');
    expect(c[0].target).toBeUndefined();
  });
});
