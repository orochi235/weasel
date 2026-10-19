import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { addStage, stageFromType, type EffectDoc } from '@weasel-js/diagram/effect';
import { CHART_STAGE_TYPES } from './stageTypes';
import { PIPELINE_STORAGE_KEY, usePipelineDoc } from './usePipelineDoc';

const blur = CHART_STAGE_TYPES.find((t) => t.type === 'blur')!;
const source = CHART_STAGE_TYPES.find((t) => t.type === 'source')!;

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('usePipelineDoc', () => {
  it('starts empty, undoes a change back to the previous doc and redoes it', () => {
    const { result } = renderHook(() => usePipelineDoc());
    const empty = result.current.doc;
    expect(empty.pipeline.stages).toEqual([]);
    expect(result.current.canUndo).toBe(false);

    const next = addStage(empty, stageFromType(blur, 'blur'), { x: 10, y: 20 });
    act(() => result.current.change(next, 'Add stage'));
    expect(result.current.doc).toBe(next);
    expect(result.current.canUndo).toBe(true);

    act(() => result.current.undo());
    expect(result.current.doc).toBe(empty);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redo());
    expect(result.current.doc).toBe(next);
  });

  it('keeps two edits of one param as one undo step, and edits of different params apart', () => {
    const { result } = renderHook(() => usePipelineDoc());
    const empty = result.current.doc;
    const a = addStage(empty, stageFromType(blur, 'blur'));
    act(() => result.current.change(a, 'Add stage'));
    act(() => result.current.change({ ...a }, 'Set radius', 'blur:radius'));
    act(() => result.current.change({ ...a }, 'Set radius', 'blur:radius'));
    act(() => result.current.undo());
    expect(result.current.doc).toBe(a);
  });

  it('saves each change and loads it in a fresh hook', () => {
    const first = renderHook(() => usePipelineDoc());
    const next = addStage(first.result.current.doc, stageFromType(source, 'source'), { x: 1, y: 2 });
    act(() => first.result.current.change(next, 'Add stage'));
    first.unmount();

    expect(JSON.parse(localStorage.getItem(PIPELINE_STORAGE_KEY)!)).toEqual(next);
    const second = renderHook(() => usePipelineDoc());
    expect(second.result.current.doc).toEqual(next);
    expect(second.result.current.canUndo).toBe(false);
  });

  it('loads stored JSON written under its key', () => {
    const stored: EffectDoc = addStage({ pipeline: { stages: [], wires: [], types: {} }, places: {} }, stageFromType(blur, 'b'));
    localStorage.setItem('custom-key', JSON.stringify(stored));
    const { result } = renderHook(() => usePipelineDoc('custom-key'));
    expect(result.current.doc).toEqual(stored);
  });

  it('gives a stored doc without value types the empty doc\'s', () => {
    localStorage.setItem(PIPELINE_STORAGE_KEY, JSON.stringify({ pipeline: { stages: [], wires: [] }, places: {} }));
    const { result } = renderHook(() => usePipelineDoc());
    expect(result.current.doc.pipeline.types).toEqual({ number: { control: true } });
  });

  it('ignores stored text that is not a doc', () => {
    localStorage.setItem(PIPELINE_STORAGE_KEY, '{"nope":1}');
    const { result } = renderHook(() => usePipelineDoc());
    expect(result.current.doc.pipeline.stages).toEqual([]);
  });

  it('yields the empty doc, and still edits, when storage throws on access', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('denied');
    });
    const { result } = renderHook(() => usePipelineDoc());
    expect(result.current.doc.pipeline.stages).toEqual([]);
    const next = addStage(result.current.doc, stageFromType(blur, 'blur'));
    act(() => result.current.change(next, 'Add stage'));
    expect(result.current.doc).toBe(next);
  });
});
