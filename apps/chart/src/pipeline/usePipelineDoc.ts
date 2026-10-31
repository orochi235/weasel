import { readStored, useAutosave } from '@weasel-js/editor';
import type { EffectDoc } from '@weasel-js/diagram/effect';
import { createHistory, swapOp } from '@weasel-js/history';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';

export const PIPELINE_STORAGE_KEY = 'weaselchart:pipeline-v1';
export const PIPELINE_FILE_EXTENSION = '.weaselpipeline.json';

/** Long enough that one slider drag reads as one edit, short enough that two deliberate ones stay apart. */
const COALESCE_MS = 500;

const EMPTY: EffectDoc = { pipeline: { stages: [], wires: [], types: { number: { control: true } } }, places: {} };

const isDoc = (v: unknown): v is EffectDoc => {
  const d = v as Partial<EffectDoc> | null;
  return typeof d === 'object' && d !== null && Array.isArray(d.pipeline?.stages)
    && Array.isArray(d.pipeline.wires) && typeof d.places === 'object' && d.places !== null;
};

/** An empty pipeline, as New makes. */
export const emptyPipeline = (): EffectDoc => EMPTY;

/** The pipeline a `.weaselpipeline.json` file holds. Throws on text that is not one. */
export function pipelineFromJson(text: string): EffectDoc {
  const parsed: unknown = JSON.parse(text);
  if (!isDoc(parsed)) throw new Error('Not a saved pipeline');
  return parsed.pipeline.types ? parsed : { ...parsed, pipeline: { ...parsed.pipeline, types: EMPTY.pipeline.types } };
}

export interface PipelineDoc {
  doc: EffectDoc;
  /** Records `next` as one undo step named `label`. Successive changes sharing a `coalesceKey`
   *  within half a second merge into one step. */
  change: (next: EffectDoc, label: string, coalesceKey?: string) => void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Pipeline mode's document: an `EffectDoc` with its own undo history, autosaved under `storageKey`.
 *  Held above the mode switch, so the history survives a visit to chart mode. */
export function usePipelineDoc(storageKey: string = PIPELINE_STORAGE_KEY): PipelineDoc {
  const [doc, setDoc] = useState(() => readStored(storageKey, pipelineFromJson, emptyPipeline));
  const current = useRef(doc);
  const history = useMemo(() => createHistory(null, { coalesceWindowMs: COALESCE_MS }), []);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => history.subscribe(rerender), [history]);

  const emit = useCallback((next: EffectDoc) => {
    current.current = next;
    setDoc(next);
  }, []);
  useAutosave(() => ({ primary: [storageKey, JSON.stringify(doc)] }), { revision: doc });

  const change = useCallback((next: EffectDoc, label: string, coalesceKey?: string) => {
    history.apply(swapOp({
      name: 'pipeline.set', label, before: current.current, after: next, emit,
      ...(coalesceKey !== undefined ? { coalesceKey } : {}),
    }), label);
  }, [history, emit]);

  return {
    doc,
    change,
    undo: useCallback(() => history.undo(), [history]),
    redo: useCallback(() => history.redo(), [history]),
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
  };
}
