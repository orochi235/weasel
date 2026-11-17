import { decodeSnapshot, encodeSnapshot, stringifySnapshot } from '@weasel-js/core';
import { readStored, useAutosave } from '@weasel-js/editor';
import { readEffectDoc, type EffectDoc } from '@weasel-js/diagram/effect';
import { createHistory, swapOp } from '@weasel-js/history';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { reportPipelineSave } from '../reportFailure';

export const PIPELINE_STORAGE_KEY = 'weaselchart:pipeline-v1';
export const PIPELINE_FILE_EXTENSION = '.weaselpipeline.json';

const EMPTY: EffectDoc = { pipeline: { stages: [], wires: [], types: { number: { control: true } } }, places: {} };

/** An empty pipeline, as New makes. */
export const emptyPipeline = (): EffectDoc => EMPTY;

/** The pipeline as the text a `.weaselpipeline.json` file holds: core's snapshot codec, so a param's `max: Infinity`
 *  reads back as itself. */
export const pipelineToJson = (doc: EffectDoc): string => stringifySnapshot(doc);

/** The pipeline a saved one holds, as `JSON.parse` reads its text. Throws on a value that is not one. */
export function pipelineFromSaved(parsed: unknown): EffectDoc {
  const doc = readEffectDoc(decodeSnapshot(parsed));
  return doc.pipeline.types ? doc : { ...doc, pipeline: { ...doc.pipeline, types: EMPTY.pipeline.types } };
}

/** The pipeline a `.weaselpipeline.json` file holds. Throws on text that is not one. */
export const pipelineFromJson = (text: string): EffectDoc => pipelineFromSaved(JSON.parse(text));

export interface PipelineDoc {
  doc: EffectDoc;
  /** Records `next` as one undo step named `label`, from the doc as it was before any preview. */
  change: (next: EffectDoc, label: string) => void;
  /** Shows `next` while an edit runs, with no undo step. */
  preview: (next: EffectDoc) => void;
  /** Ends an edit with no step, putting back the doc as it was before its preview. */
  cancel: () => void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Pipeline mode's document: an `EffectDoc` with its own undo history, autosaved under `storageKey`.
 *  Held above the mode switch, so the history survives a visit to chart mode. */
export function usePipelineDoc(storageKey: string = PIPELINE_STORAGE_KEY): PipelineDoc {
  const [doc, setDoc] = useState(() => readStored(storageKey, pipelineFromSaved, emptyPipeline));
  const current = useRef(doc);
  // The doc as it was before the preview on screen, while one is.
  const base = useRef<EffectDoc | null>(null);
  const history = useMemo(() => createHistory(null), []);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  useEffect(() => history.subscribe(rerender), [history]);

  const emit = useCallback((next: EffectDoc) => {
    current.current = next;
    setDoc(next);
  }, []);
  useAutosave(() => ({ primary: [storageKey, encodeSnapshot(doc)] }), { revision: doc, onSaved: reportPipelineSave });

  const change = useCallback((next: EffectDoc, label: string) => {
    const before = base.current ?? current.current;
    base.current = null;
    history.apply(swapOp({ name: 'pipeline.set', label, before, after: next, emit }), label);
  }, [history, emit]);
  const preview = useCallback((next: EffectDoc) => {
    base.current ??= current.current;
    emit(next);
  }, [emit]);
  const cancel = useCallback(() => {
    const was = base.current;
    base.current = null;
    if (was !== null && was !== current.current) emit(was);
  }, [emit]);

  return {
    doc,
    change,
    preview,
    cancel,
    undo: useCallback(() => { cancel(); history.undo(); }, [history, cancel]),
    redo: useCallback(() => { cancel(); history.redo(); }, [history, cancel]),
    canUndo: history.canUndo(),
    canRedo: history.canRedo(),
  };
}
