/**
 * The corner controls over a live selection: what to show, kept current as
 * the scene and the anchor selection change, and a change handler that runs
 * `setCorners` on the registry the caller sits under.
 */
import { useActionsRegistry } from '@weasel-js/routing/react';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { resolveEditablePathOf, type EditableShape, type NodeId } from '@weasel-js/core';
import { CORNER_CONTROLS, CORNER_CONTROLS_PROMPT, cornerControlsParams, cornerControlsState } from './cornerControls';

/** The part of a scene the controls read. */
export interface CornerControlsScene {
  get(id: NodeId): EditableShape | undefined;
  subscribe(listener: () => void): () => void;
}

/** Which path is open for anchor editing and which of its anchors are
 *  selected: what a `PathEditHost` that owns the anchor selection knows. */
export interface CornerControlsSelection {
  editingId(): string | null;
  selectedAnchors(): ReadonlySet<number>;
  subscribe(listener: () => void): () => void;
}

export interface UseCornerControlsReturn {
  /** The schema a prefs form draws: `CORNER_CONTROLS`. Its `name` is the
   *  controls' title. */
  schema: typeof CORNER_CONTROLS;
  /** What to show above the form, or null once a corner is selected. */
  prompt: string | null;
  values: Record<string, unknown>;
  mixed: ReadonlySet<string>;
  /** A prefs form's `onChange` for `CORNER_CONTROLS`. */
  onChange: (field: string, value: unknown) => void;
}

function snapshot(scene: CornerControlsScene, selection: CornerControlsSelection): string {
  const id = selection.editingId();
  const path = id ? resolveEditablePathOf(scene.get(id as NodeId)) : null;
  const { values, mixed } = cornerControlsState(path, selection.selectedAnchors());
  return JSON.stringify({ values, mixed: [...mixed] });
}

export function useCornerControls(
  scene: CornerControlsScene,
  selection: CornerControlsSelection,
): UseCornerControlsReturn {
  const actions = useActionsRegistry();
  const subscribe = useCallback((l: () => void) => {
    const offScene = scene.subscribe(l);
    const offSelection = selection.subscribe(l);
    return () => { offScene(); offSelection(); };
  }, [scene, selection]);
  const key = useSyncExternalStore(subscribe, () => snapshot(scene, selection));
  const shown = useMemo(() => {
    const parsed = JSON.parse(key) as { values: Record<string, unknown>; mixed: string[] };
    return { values: parsed.values, mixed: new Set(parsed.mixed) };
  }, [key]);
  const onChange = useCallback((field: string, value: unknown) => {
    const params = cornerControlsParams(field, value);
    if (params) actions?.trigger('setCorners', params);
  }, [actions]);
  const prompt = shown.values.count === 0 ? CORNER_CONTROLS_PROMPT : null;
  return { schema: CORNER_CONTROLS, prompt, ...shown, onChange };
}
