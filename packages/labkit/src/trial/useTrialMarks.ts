import { useLatest } from '@weasel-js/core';
import { createEmitter, deepEqual } from '@weasel-js/registry';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { annotationsFromJSON } from '../annotations/store';
import type {
  AnnotationsApi,
  AnnotationsCapability,
  AnnotationTargetInfo,
} from '../annotations/types';
import type { TrialRecord } from '../state/types';

type MarkStore = ReturnType<typeof annotationsFromJSON>;

/** What `useTrialMarks` takes. */
export interface TrialMarksOptions {
  record: TrialRecord;
  /** The trial's resolved config, which `targets` and an export read. */
  config: unknown;
  capability: AnnotationsCapability | undefined;
  /** The marks an instrument's own `AnnotationStorage` loaded. */
  keptMarks: unknown;
  /** Keep the marks in the trial's record, where the instrument keeps none. */
  save: (trialId: string, doc: unknown) => void;
}

/** A trial's marks. */
export interface TrialMarks {
  annotations: MarkStore;
  /** `annotations`, with a `subscribe` that also fires when what its targets
   *  and config answer from has committed. */
  provided: AnnotationsApi;
  /** Whether the mark history can step each way. */
  moves: { undo: boolean; redo: boolean };
}

const sameMarks = (a: unknown, b: unknown): boolean => deepEqual(a, b, { undefinedAsAbsent: true });

/**
 * A trial's mark store: built from where the marks were kept, saved back on a
 * debounce, and built again when the record's marks change under it — another
 * tab's write, which this tab's next save would otherwise erase.
 */
export function useTrialMarks({
  record,
  config,
  capability: annotationsCap,
  keptMarks,
  save,
}: TrialMarksOptions): TrialMarks {
  // The capability's own `targets` thunk, re-read on every call: a target
  // resizing or gaining a dependency must not need the store rebuilt. Held in
  // a ref because the store closes over it.
  const targetsRef = useLatest((): readonly AnnotationTargetInfo[] =>
    annotationsCap
      ? annotationsCap.targets(record.state, config, { id: record.id, view: record.view })
      : [],
  );
  // Read through refs for the same reason `targets` is: an export must draw
  // against the config the trial holds now.
  const configRef = useLatest(config);
  // The instrument can be swapped under a live trial, so the capability is read at use too.
  const capRef = useLatest(annotationsCap);
  const build = (doc: unknown): MarkStore =>
    annotationsFromJSON(doc, () => targetsRef.current(), {
      meaning: () => capRef.current?.meaning,
      config: () => configRef.current,
      onCapture: (result) => capRef.current?.onCapture?.(result),
      selection: () => capRef.current?.selection,
    });

  const ownsStorage = annotationsCap?.storage !== undefined;
  // Seeded from wherever the marks were kept: the instrument's own store if it
  // declared one, else this trial's slot, which `from` remembers.
  const [held, setHeld] = useState(() => ({
    store: build(ownsStorage ? keptMarks : record.annotations),
    from: record.annotations,
  }));
  const saved = useRef<unknown>(undefined);
  let annotations = held.store;
  if (!ownsStorage && record.annotations !== held.from) {
    // A write that changed no mark keeps the store, and its undo history with it.
    const own =
      record.annotations === saved.current || sameMarks(record.annotations, annotations.toJSON());
    if (!own) annotations = build(record.annotations);
    setHeld({ store: annotations, from: record.annotations });
  }

  // Chrome reads the store while it renders — a mark list, the export menu,
  // the overview — and the store reads the refs above, which hold the last
  // commit. So once a change to them commits, those readers are told to read
  // again. Through the context's `subscribe` alone: the store's own would have
  // the debounce below save marks that did not change.
  const inputsCommitted = useRef(createEmitter());
  // biome-ignore lint/correctness/useExhaustiveDependencies: these are what `targets` and `config` answer from — the signal, not values this reads
  useLayoutEffect(() => {
    inputsCommitted.current.emit();
  }, [record.state, record.view, config, annotationsCap]);
  const provided = useMemo<AnnotationsApi>(
    () => ({
      ...annotations,
      subscribe: (fn) => {
        const off = annotations.subscribe(fn);
        const offCommitted = inputsCommitted.current.subscribe(fn);
        return () => {
          off();
          offCommitted();
        };
      },
    }),
    [annotations],
  );

  useSavedMarks(annotations, annotationsCap, (doc) => {
    saved.current = doc;
    save(record.id, doc);
  });

  // Only when the pair flips, which is rare: bumping React state on every
  // scene notification would re-render the trial on every frame of a drag,
  // which is the thing the debounce below exists to avoid.
  const [markMoves, setMarkMoves] = useState({ undo: false, redo: false });
  useEffect(() => {
    if (!annotationsCap) return;
    const read = (): void => {
      const next = { undo: annotations.canUndo(), redo: annotations.canRedo() };
      setMarkMoves((prev) => (prev.undo === next.undo && prev.redo === next.redo ? prev : next));
    };
    read();
    return annotations.subscribe(read);
  }, [annotations, annotationsCap]);

  return { annotations, provided, moves: markMoves };
}

/**
 * Save `annotations` on a trailing debounce rather than per notification: a
 * scene mutates every frame of a drag, and a zustand write per frame re-renders
 * every trial in the lab. The unmount flush is not an optimization — the last
 * mark before a trial closes is otherwise lost.
 */
function useSavedMarks(
  annotations: MarkStore,
  annotationsCap: AnnotationsCapability | undefined,
  keep: (doc: unknown) => void,
): void {
  const saveCap = annotationsCap?.storage;
  const saveRef = useLatest((doc: unknown): void => {
    if (saveCap) saveCap.save(doc as never);
    else keep(doc);
  });
  const held = useLatest(annotations);
  useEffect(() => {
    if (!annotationsCap) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let dirty = false;
    const flush = (): void => {
      if (!dirty) return;
      dirty = false;
      saveRef.current(annotations.toJSON());
    };
    const off = annotations.subscribe(() => {
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, 250);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
      // A store the record's marks replaced lost to that write, unsaved marks and all.
      // eslint-disable-next-line react-hooks/exhaustive-deps -- read at cleanup on purpose: by then it is the store that took this one's place
      if (held.current === annotations) flush();
    };
  }, [annotations, annotationsCap, saveRef, held]);
}
