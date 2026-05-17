import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCloneTool } from './useCloneTool';
import { cloneByAltDrag } from 'interactions/actions/clone/behaviors/cloneByAltDrag';
import type { InsertAdapter, Op } from '../../../index';

interface Obj { id: string }

function makeAdapter(opts: { selection?: string[] } = {}) {
  const applied: Array<{ ops: Op[]; label: string }> = [];
  const adapter: InsertAdapter<Obj> = {
    commitInsert: () => null,
    commitPaste: (snap) => snap.items.map((item) => ({ id: `new-${(item as { id: string }).id}` }) as Obj),
    snapshotSelection: (ids) => ({ items: ids.map((id) => ({ id })) }),
    insertNode: () => {},
    setSelection: () => {},
    applyOps: (ops, label) => { applied.push({ ops, label: label ?? '' }); },
    getSelection: () => opts.selection ?? [],
  };
  return { adapter, applied };
}

describe('useCloneTool', () => {
  // Phase 14e Task 3: legacy `useClone` hook removed. Drag flows entirely
  // through `cloneAction` via the gesture dispatcher; the tool only
  // declares id/cursor/presentation + the dispatcher binding. Route-table
  // drag / overlay / cloneSelection tests are gone — those paths are
  // covered by `cloneAction`'s own tests.
  it('declares default id and cursor', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useCloneTool(adapter, { behaviors: [cloneByAltDrag()] }),
    );
    const tool = result.current;
    expect(tool.id).toBe('clone');
    const cursor = typeof tool.cursor === 'function'
      ? (tool.cursor as (ctx: unknown) => string)({ scratch: null })
      : tool.cursor;
    expect(cursor).toBe('copy');
  });

  it('respects custom id / cursor options', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useCloneTool(adapter, {
        behaviors: [cloneByAltDrag()],
        id: 'dup',
        cursor: 'crosshair',
      }),
    );
    const tool = result.current;
    expect(tool.id).toBe('dup');
    const cursor = typeof tool.cursor === 'function'
      ? (tool.cursor as (ctx: unknown) => string)({ scratch: null })
      : tool.cursor;
    expect(cursor).toBe('crosshair');
  });

  it('declares the dispatcher binding for clone (alt-drag on selected-body)', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useCloneTool(adapter, { behaviors: [cloneByAltDrag()] }),
    );
    const tool = result.current;
    const bindings = tool.bindings ?? [];
    expect(bindings.length).toBe(1);
    expect(bindings[0].actionId).toBe('clone');
    expect(bindings[0].spec.kind).toBe('drag');
  });
});
