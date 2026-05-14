// React hook that bridges the swillustrator scene to the IDB store.
//
// On mount: pull the snapshot, replace itemsRef/groupsRef, publish to React,
//   then mark `restored: true` so the caller can bump nextId past the loaded
//   ids.
// While mounted: any render after restore schedules a debounced write
//   (300ms idle). The debounce absorbs publish bursts during a drag so we
//   don't hit IDB once per frame.
// On unmount: fire-and-forget any pending write so the last edit survives.

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { Group, SerializedHistory } from '@orochi235/weasel';
import type { Obj } from './poseUpdate';
import {
  loadScene,
  saveScene,
  type Document,
  type SceneSnapshot,
  type View,
} from './sceneStore';

const DEBOUNCE_MS = 300;

export interface UsePersistedSceneArgs {
  itemsRef: MutableRefObject<Obj[]>;
  groupsRef: MutableRefObject<Group[]>;
  setItems: (next: Obj[]) => void;
  setGroups: (next: Group[]) => void;
  doc: Document;
  setDoc: (next: Document) => void;
  view: View;
  setView: (next: View) => void;
  publish: () => void;
  /** Resets the history stack — called only when the snapshot has no
   *  persisted history (older snapshots, or fresh DBs). When history is
   *  present we restore it instead, so the undo stack survives reload. */
  resetHistory: () => void;
  /** Read the current selection at save time. Returns plain ids (the
   *  NodeId brand is structural, so a string[] is fine over the wire). */
  getSelection: () => string[];
  /** Apply a restored selection. Called once after the snapshot's items
   *  have been published so the ids it references actually exist. */
  setSelection: (ids: string[]) => void;
  /** Read the current history in serialized form at save time. */
  getHistory: () => SerializedHistory;
  /** Replace the live history with a restored snapshot. Called after
   *  scene state is in place so the first undo's invert lands on the
   *  correctly-restored adapter state. */
  setHistory: (snapshot: SerializedHistory) => void;
}

export function usePersistedScene(args: UsePersistedSceneArgs): { restored: boolean } {
  const {
    itemsRef, groupsRef,
    doc, setDoc, view, setView,
    publish, resetHistory,
    getSelection, setSelection,
    getHistory, setHistory,
  } = args;

  // Selection is read at write-time via a ref so the persist effect doesn't
  // re-bind on every selection change. `setSelection` is only called once at
  // restore, so it stays in closure.
  const getSelectionRef = useRef(getSelection);
  getSelectionRef.current = getSelection;
  // Same pattern for history — read latest at save time, no effect re-bind.
  const getHistoryRef = useRef(getHistory);
  getHistoryRef.current = getHistory;

  const [restored, setRestored] = useState(false);

  // Stable mirror refs so the write path (which fires after every render)
  // always reads the latest values without re-binding the effect.
  const docRef = useRef(doc);
  docRef.current = doc;
  const viewRef = useRef(view);
  viewRef.current = view;

  // True after the load attempt completes — gates the write effect so we
  // don't persist the empty initial state on top of a real snapshot.
  const readyRef = useRef(false);
  const restoreStartedRef = useRef(false);

  // Restore once on mount.
  useEffect(() => {
    if (restoreStartedRef.current) return;
    restoreStartedRef.current = true;
    let cancelled = false;
    void (async () => {
      const snap: SceneSnapshot | null = await loadScene();
      if (cancelled) return;
      if (snap && snap.version === 1) {
        itemsRef.current = snap.items;
        groupsRef.current = snap.groups;
        // publish() resyncs React state from the refs; setDoc/setView push
        // the non-ref fields; resetHistory wipes any history captured against
        // the (empty) pre-restore state. Selection lands last — it references
        // ids that must already be in itemsRef.current.
        publish();
        setDoc(snap.doc);
        setView(snap.view);
        if (snap.selection && snap.selection.length > 0) {
          // Filter to ids still present — defensive against snapshots that
          // somehow drift, though that shouldn't happen in practice.
          const valid = new Set(snap.items.map((o) => o.id));
          const restored = snap.selection.filter((id) => valid.has(id));
          if (restored.length > 0) setSelection(restored);
        }
        // Restore history LAST: scene + selection are in place, so the
        // first undo's invert lands on the correct restored state. Older
        // snapshots that predate history persistence fall through to the
        // legacy clear-on-restore path.
        if (snap.history && snap.history.version === 1) {
          setHistory(snap.history);
        } else {
          resetHistory();
        }
        setRestored(true);
      }
      readyRef.current = true;
    })();
    return () => { cancelled = true; };
    // Runs once; refs and callbacks from App are stable for the app lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced write. Coalesces a burst of renders (drag at 60fps) into one
  // IDB transaction. saveScene is fire-and-forget — it awaits its tx
  // internally and swallows errors.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writePendingRef = useRef(false);

  const flush = (): void => {
    if (!writePendingRef.current) return;
    writePendingRef.current = false;
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const snap: SceneSnapshot = {
      version: 1,
      items: itemsRef.current.slice(),
      groups: groupsRef.current.slice(),
      doc: docRef.current,
      view: viewRef.current,
      selection: getSelectionRef.current(),
      history: getHistoryRef.current(),
    };
    void saveScene(snap);
  };

  const scheduleWrite = (): void => {
    writePendingRef.current = true;
    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      flush();
    }, DEBOUNCE_MS);
  };

  // Schedule on every render after restore completes. The debounce keeps
  // IDB traffic bounded; renders that don't actually change scene data are
  // cheap (timer reset + ref reads). We deliberately don't try to detect
  // which fields changed — items mutate in place through refs, so length
  // and identity checks miss the common case.
  useEffect(() => {
    if (!readyRef.current) return;
    scheduleWrite();
  });

  // Flush on unmount. IDB tx is async but we let it run to completion in
  // the background — the page is unloading either way.
  useEffect(() => {
    return () => {
      if (writePendingRef.current) flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { restored };
}
