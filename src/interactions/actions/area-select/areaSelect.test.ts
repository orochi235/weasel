import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAreaSelect } from './areaSelect';
import { selectFromMarquee } from './behaviors/selectFromMarquee';
import type { AreaSelectAdapter, Op } from '../../..';

function makeAdapter(initial: string[] = []) {
  let selection = [...initial];
  const ops: { kind: 'applyOps'; ops: Op[] }[] = [];
  const batches: { ops: Op[]; label: string }[] = [];
  const adapter: AreaSelectAdapter = {
    hitTestArea: () => [],
    getSelection: () => selection,
    setSelection: (ids) => { selection = [...ids]; },
    // Unified applyOps: no label = transient (records in ops), label present =
    // history-aware (records in batches). Matches the post-rename contract where
    // applyOps replaces both the old applyOps (transient) and applyBatch (labeled).
    applyOps: (oo, label) => {
      if (label !== undefined) {
        batches.push({ ops: oo, label });
      } else {
        ops.push({ kind: 'applyOps', ops: oo });
      }
      for (const op of oo) op.apply(adapter as never);
    },
  };
  return { adapter, ops, batches, getSelection: () => selection };
}

const NO_MOD = { alt: false, shift: false, meta: false, ctrl: false };

describe('useAreaSelect — start / cancel', () => {
  it('start sets isAreaSelecting + overlay; cancel clears them with no ops', () => {
    const { adapter, ops } = makeAdapter();
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    expect(result.current.isAreaSelecting).toBe(false);

    act(() => { result.current.start(1, 2, NO_MOD); });
    expect(result.current.isAreaSelecting).toBe(true);
    expect(result.current.overlay).toEqual({
      start: { worldX: 1, worldY: 2 },
      current: { worldX: 1, worldY: 2 },
      shiftHeld: false,
    });

    act(() => { result.current.cancel(); });
    expect(result.current.isAreaSelecting).toBe(false);
    expect(result.current.overlay).toBeNull();
    expect(ops).toEqual([]);
  });
});

describe('useAreaSelect — move', () => {
  it('move updates overlay.current; preserves shiftHeld from start', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    act(() => { result.current.start(1, 2, { ...NO_MOD, shift: true }); });
    act(() => { result.current.move(5, 7, NO_MOD); });
    expect(result.current.overlay).toEqual({
      start: { worldX: 1, worldY: 2 },
      current: { worldX: 5, worldY: 7 },
      shiftHeld: true,
    });
  });

  it('move while inactive returns false and does not set overlay', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    let returned = true;
    act(() => { returned = result.current.move(1, 1, NO_MOD); });
    expect(returned).toBe(false);
    expect(result.current.overlay).toBeNull();
  });
});

describe('useAreaSelect — end', () => {
  it('default (selectFromMarquee → defaultTransient: true): commits via applyOps, not applyOps', () => {
    const { adapter, ops, batches, getSelection } = makeAdapter(['existing']);
    (adapter as { hitTestArea: (r: unknown) => string[] }).hitTestArea = () => ['x', 'y'];
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(4, 4, NO_MOD); });
    act(() => { result.current.end(); });
    expect(ops).toHaveLength(1);
    expect(batches).toEqual([]);
    expect(getSelection()).toEqual(['x', 'y']);
  });

  it('cancel produces no ops even after move', () => {
    const { adapter, ops } = makeAdapter();
    (adapter as { hitTestArea: (r: unknown) => string[] }).hitTestArea = () => ['x'];
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(4, 4, NO_MOD); });
    act(() => { result.current.cancel(); });
    expect(ops).toEqual([]);
  });

  it('options.transient = false overrides defaultTransient: routes through applyOps', () => {
    const { adapter, ops, batches } = makeAdapter();
    (adapter as { hitTestArea: (r: unknown) => string[] }).hitTestArea = () => ['x'];
    const { result } = renderHook(() =>
      useAreaSelect(adapter, {
        behaviors: [selectFromMarquee()],
        transient: false,
        label: 'Pick',
      }),
    );
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(4, 4, NO_MOD); });
    act(() => { result.current.end(); });
    expect(ops).toEqual([]);
    expect(batches).toHaveLength(1);
    expect(batches[0].label).toBe('Pick');
  });

  it('end with no behaviors emitting ops produces no commit', () => {
    const { adapter, ops, batches } = makeAdapter();
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [] }),
    );
    act(() => { result.current.start(0, 0, NO_MOD); });
    act(() => { result.current.move(4, 4, NO_MOD); });
    act(() => { result.current.end(); });
    expect(ops).toEqual([]);
    expect(batches).toEqual([]);
  });
});

import type { Result } from '../../../tools/routing';

describe('useAreaSelect.beginAt', () => {
  it('returns a begin Result with continuation closures', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    const ctx = {
      worldX: 10,
      worldY: 20,
      modifiers: { mod: false, shift: false, alt: false, ctrl: false, meta: false, space: false },
      scratch: null,
    } as never;

    let r: Result<{ kind: 'area' }>;
    act(() => { r = result.current.beginAt(ctx); });

    expect(r!.kind).toBe('begin');
    if (r!.kind === 'begin') {
      expect(r!.spec.scratch).toEqual({ kind: 'area' });
      expect(r!.spec.onMove).toBeDefined();
      expect(r!.spec.onRelease).toBeDefined();
    }
  });

  it('onMove delegates to internal move and returns hold', () => {
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    const ctx = {
      worldX: 0,
      worldY: 0,
      modifiers: { shift: false, alt: false, ctrl: false, meta: false, space: false },
      scratch: { kind: 'area' as const },
    } as never;
    const moveCtx = {
      worldX: 5,
      worldY: 8,
      modifiers: { shift: false, alt: false, ctrl: false, meta: false, space: false },
      scratch: { kind: 'area' as const },
    } as never;

    let r: Result<{ kind: 'area' }>;
    act(() => { r = result.current.beginAt(ctx); });

    let moveResult: Result<{ kind: 'area' }>;
    act(() => {
      if (r!.kind === 'begin') {
        moveResult = r!.spec.onMove!(moveCtx);
      }
    });

    expect(moveResult!.kind).toBe('hold');
    // overlay should reflect the moved position
    expect(result.current.overlay?.current).toEqual({ worldX: 5, worldY: 8 });
  });

  it('onRelease ends the gesture and returns cancel', () => {
    const { adapter } = makeAdapter();
    (adapter as { hitTestArea: (r: unknown) => string[] }).hitTestArea = () => ['a', 'b'];
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { behaviors: [selectFromMarquee()] }),
    );
    const ctx = {
      worldX: 0,
      worldY: 0,
      modifiers: { shift: false, alt: false, ctrl: false, meta: false, space: false },
      scratch: { kind: 'area' as const },
    } as never;

    let r: Result<{ kind: 'area' }>;
    act(() => { r = result.current.beginAt(ctx); });

    let releaseResult: Result<{ kind: 'area' }>;
    act(() => {
      if (r!.kind === 'begin') {
        releaseResult = r!.spec.onRelease!(ctx);
      }
    });

    expect(releaseResult!.kind).toBe('cancel');
    expect(result.current.isAreaSelecting).toBe(false);
  });
});

import { createDebugSink } from '../../../debug/createDebugSink';

describe('useAreaSelect — debug recording', () => {
  it('records the marquee bounds during drag', () => {
    const sink = createDebugSink({ bounds: true });
    const { adapter } = makeAdapter();
    const { result } = renderHook(() =>
      useAreaSelect(adapter, { debug: sink }),
    );
    act(() => { result.current.start(10, 10, NO_MOD); });
    act(() => { result.current.move(50, 40, NO_MOD); });
    const b = sink.snapshot().bounds.find((x) => x.id === 'area-select');
    expect(b).toBeDefined();
    expect(b!.bounds).toEqual({ x: 10, y: 10, width: 40, height: 30 });
  });
});
