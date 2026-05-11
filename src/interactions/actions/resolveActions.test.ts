/**
 * Tests for `resolveActions` — the pure resolver that merges consumer
 * `actions` overrides into the standard default set.
 *
 * Branches verified:
 *   - `actions === null` opt-out → empty list.
 *   - default set includes selectAll/escape/nudge/reorder; duplicate gated
 *     on `cloneNode` presence.
 *   - per-slot override: `null` deletes; `Partial<Action>` merges onto
 *     default; full descriptor on a fresh id is registered.
 *   - mismatched id vs slot key warns once and uses the slot key.
 *   - partial entry with no matching default warns once and skips.
 *   - duplicate default uses provided `cloneNode` + `duplicateOffset`.
 *   - nudgeStep / nudgeShiftStep forwarded.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveActions,
  resetActionResolverWarnings,
  type StandardActionsDeps,
  type StandardActionDefaults,
} from './resolveActions';
import type { NodeId } from 'core/scene/types';

interface TestPose { x: number; y: number }

function makeDeps(): StandardActionsDeps<TestPose> {
  return {
    getSelection: () => [],
    setSelection: () => {},
    listAll: () => ['a' as NodeId, 'b' as NodeId],
    getPose: () => ({ x: 0, y: 0 }),
    applyBatch: () => {},
    translatePose: (p, dx, dy) => ({ x: p.x + dx, y: p.y + dy }),
  };
}

beforeEach(() => {
  resetActionResolverWarnings();
});

describe('resolveActions — defaults', () => {
  it('returns selectAll + escape + nudge + reorder when no cloneNode supplied', () => {
    const out = resolveActions(makeDeps());
    const ids = out.map((a) => a.id);
    expect(ids).toContain('selectAll');
    expect(ids).toContain('escape');
    // Eight nudge actions for the four arrow keys × {step, shiftStep}.
    expect(ids.filter((id) => id.startsWith('nudge.')).length).toBeGreaterThanOrEqual(8);
    // Reorder actions (bringToFront / sendToBack / forward / backward).
    expect(ids.filter((id) => id.startsWith('reorder.')).length).toBeGreaterThanOrEqual(2);
    // No duplicate default when cloneNode is absent.
    expect(ids).not.toContain('duplicate');
  });

  it('adds duplicate when cloneNode is provided', () => {
    const cloneNode = (id: NodeId) => ({ id: (`${id}-copy`) as NodeId });
    const out = resolveActions(makeDeps(), {
      defaults: { cloneNode },
    });
    expect(out.map((a) => a.id)).toContain('duplicate');
  });

  it('returns an empty array when actions === null (opt-out)', () => {
    const out = resolveActions(makeDeps(), { actions: null });
    expect(out).toEqual([]);
  });
});

describe('resolveActions — overrides', () => {
  it('null override deletes a default slot', () => {
    const out = resolveActions(makeDeps(), { actions: { selectAll: null } });
    expect(out.find((a) => a.id === 'selectAll')).toBeUndefined();
  });

  it('partial override merges onto the default (keeps default run)', () => {
    const out = resolveActions(makeDeps(), {
      actions: { selectAll: { label: 'Pick All' } },
    });
    const sa = out.find((a) => a.id === 'selectAll');
    expect(sa?.label).toBe('Pick All');
    // run is untouched — still the default's function.
    expect(typeof sa?.run).toBe('function');
  });

  it('full descriptor with a new id registers a fresh action', () => {
    const run = vi.fn();
    const out = resolveActions(makeDeps(), {
      actions: {
        myCustom: { id: 'myCustom', label: 'Custom', run },
      },
    });
    const a = out.find((x) => x.id === 'myCustom');
    expect(a).toBeDefined();
    expect(a?.label).toBe('Custom');
    a?.run();
    expect(run).toHaveBeenCalledOnce();
  });

  it('mismatched entry.id vs slot key warns once and keeps the slot key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const run = () => {};
    // First call: warning fires.
    const out1 = resolveActions(makeDeps(), {
      actions: { selectAll: { id: 'somethingElse', label: 'X', run } },
    });
    expect(out1.find((a) => a.id === 'selectAll')?.label).toBe('X');
    expect(out1.find((a) => a.id === 'somethingElse')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    // Second call: warning is silenced (already noted).
    resolveActions(makeDeps(), {
      actions: { selectAll: { id: 'somethingElse', label: 'X', run } },
    });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('partial entry with no matching default warns once and skips', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = resolveActions(makeDeps(), {
      // Partial (missing run); no default 'newThing' slot.
      actions: { newThing: { label: 'X' } },
    });
    expect(out.find((a) => a.id === 'newThing')).toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
    // Second call: no additional warning.
    resolveActions(makeDeps(), { actions: { newThing: { label: 'X' } } });
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('resolveActions — defaults options', () => {
  it('forwards duplicateOffset to the duplicate action factory', () => {
    const cloneNode = vi.fn((id: NodeId) => ({ id: `${id}-copy` as NodeId }));
    const applyBatch = vi.fn();
    const deps: StandardActionsDeps<TestPose> = {
      ...makeDeps(),
      getSelection: () => ['a' as NodeId],
      applyBatch,
    };
    const defaults: StandardActionDefaults<TestPose> = {
      cloneNode,
      duplicateOffset: { dx: 7, dy: 3 },
    };
    const out = resolveActions(deps, { defaults });
    const dup = out.find((a) => a.id === 'duplicate');
    expect(dup).toBeDefined();
    dup?.run();
    // cloneNode should be invoked with the configured offset.
    expect(cloneNode).toHaveBeenCalledWith('a', { dx: 7, dy: 3 });
  });

  it('forwards nudgeStep / nudgeShiftStep to nudge actions', () => {
    const applyBatch = vi.fn();
    const translatePose = vi.fn((p: TestPose, dx: number, dy: number) => ({ x: p.x + dx, y: p.y + dy }));
    const deps: StandardActionsDeps<TestPose> = {
      ...makeDeps(),
      getSelection: () => ['a' as NodeId],
      applyBatch,
      translatePose,
    };
    const out = resolveActions(deps, {
      defaults: { nudgeStep: 5, nudgeShiftStep: 50 },
    });
    // Step nudge: e.g. 'nudge.right'. Shift variant uses the larger step.
    const right = out.find((a) => a.id === 'nudge.right');
    const rightShift = out.find((a) => a.id === 'nudge.right.big');
    expect(right).toBeDefined();
    expect(rightShift).toBeDefined();
    right?.run();
    expect(translatePose).toHaveBeenCalledWith({ x: 0, y: 0 }, 5, 0);
    rightShift?.run();
    expect(translatePose).toHaveBeenCalledWith({ x: 0, y: 0 }, 50, 0);
  });
});
