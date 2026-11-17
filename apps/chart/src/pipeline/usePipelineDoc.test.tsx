import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { IMAGE_STAGE_TYPES, addStage, stageFromType, type EffectDoc } from '@weasel-js/diagram/effect';
import { PIPELINE_STORAGE_KEY, emptyPipeline, pipelineFromJson, pipelineToJson, usePipelineDoc } from './usePipelineDoc';

const blur = IMAGE_STAGE_TYPES.find((t) => t.type === 'blur')!;
const source = IMAGE_STAGE_TYPES.find((t) => t.type === 'source')!;

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

  it('shows a preview without an undo step, and records the edit it ends in as one step from where it began', () => {
    const { result } = renderHook(() => usePipelineDoc());
    const empty = result.current.doc;
    const a = addStage(empty, stageFromType(blur, 'blur'));
    act(() => result.current.change(a, 'Add stage'));
    const b1 = { ...a };
    const b2 = { ...a };
    act(() => result.current.preview(b1));
    act(() => result.current.preview(b2));
    expect(result.current.doc).toBe(b2);
    const b3 = { ...a };
    act(() => result.current.change(b3, 'Set radius'));
    expect(result.current.doc).toBe(b3);
    act(() => result.current.undo());
    expect(result.current.doc).toBe(a);
    act(() => result.current.undo());
    expect(result.current.doc).toBe(empty);
  });

  it('puts a canceled preview back, leaving the undo and redo stacks as they were', () => {
    const { result } = renderHook(() => usePipelineDoc());
    const empty = result.current.doc;
    const a = addStage(empty, stageFromType(blur, 'blur'));
    const c = { ...a };
    act(() => result.current.change(a, 'Add stage'));
    act(() => result.current.change(c, 'Set radius'));
    act(() => result.current.undo());
    act(() => result.current.preview({ ...a }));
    act(() => result.current.cancel());
    expect(result.current.doc).toBe(a);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.doc).toBe(empty);
  });

  it('keeps two quick edits of one param as two undo steps', () => {
    const { result } = renderHook(() => usePipelineDoc());
    const a = addStage(result.current.doc, stageFromType(blur, 'blur'));
    const b = { ...a };
    act(() => result.current.change(a, 'Add stage'));
    act(() => result.current.change(b, 'Set radius'));
    act(() => result.current.change({ ...a }, 'Set radius'));
    act(() => result.current.undo());
    expect(result.current.doc).toBe(b);
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

  /** A blur stage whose radius has no upper bound. */
  const unbounded = (): EffectDoc => {
    const doc = addStage(emptyPipeline(), stageFromType(blur, 'blur'));
    const [stage] = doc.pipeline.stages;
    const param = { id: 'radius', label: 'Radius', value: '2', control: { kind: 'number' as const, value: 2, min: 0, max: Infinity } };
    return { ...doc, pipeline: { ...doc.pipeline, stages: [{ ...stage!, params: [param] }] } };
  };

  it('reopens a saved pipeline whose param has no upper bound', () => {
    const first = renderHook(() => usePipelineDoc());
    const doc = unbounded();
    act(() => first.result.current.change(doc, 'Add stage'));
    first.unmount();

    const second = renderHook(() => usePipelineDoc());
    expect(second.result.current.doc).toEqual(doc);
  });

  it('opens a saved file whose param has no upper bound', () => {
    const doc = unbounded();
    expect(pipelineFromJson(pipelineToJson(doc))).toEqual(doc);
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

  it('starts empty over a stored doc holding a stage that is not one', () => {
    localStorage.setItem(PIPELINE_STORAGE_KEY, '{"pipeline":{"stages":[null],"wires":[]},"places":{}}');
    const { result } = renderHook(() => usePipelineDoc());
    expect(result.current.doc.pipeline.stages).toEqual([]);
  });

  it('refuses a pipeline file naming the field that is wrong', () => {
    expect(() => pipelineFromJson('{"pipeline":{"stages":[],"wires":[{"from":1}]},"places":{}}'))
      .toThrow('Not an effect document: doc.pipeline.wires[0].from is not an object');
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
