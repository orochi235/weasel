/**
 * The fillet controls over a live selection: what to show, kept current as
 * the scene and the anchor selection change, and a change handler that runs
 * `setFillets` on the registry the caller sits under.
 */
import { useActionsRegistry } from '@weasel-js/routing/react';
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { resolveEditablePathOf, type EditableShape, type NodeId } from '@weasel-js/core';
import { FILLET_CONTROLS, FILLET_CONTROLS_PROMPT, filletControlsParams, filletControlsState } from './filletControls';

/** The part of a scene the controls read. */
export interface FilletControlsScene {
  get(id: NodeId): EditableShape | undefined;
  subscribe(listener: () => void): () => void;
}

/** Which path is open for anchor editing and which of its anchors are
 *  selected: what a `PathEditHost` that owns the anchor selection knows. */
export interface FilletControlsSelection {
  editingId(): string | null;
  selectedAnchors(): ReadonlySet<number>;
  subscribe(listener: () => void): () => void;
}

/** What {@link useFilletControls} gives a corner panel to draw. */
export interface UseFilletControlsReturn {
  /** The schema a prefs form draws: `FILLET_CONTROLS`. Its `name` is the
   *  controls' title. */
  schema: typeof FILLET_CONTROLS;
  /** What to show above the form, or null once a corner is selected. */
  prompt: string | null;
  values: Record<string, unknown>;
  mixed: ReadonlySet<string>;
  /** A prefs form's `onChange` for `FILLET_CONTROLS`. */
  onChange: (field: string, value: unknown) => void;
}

function snapshot(scene: FilletControlsScene, selection: FilletControlsSelection): string {
  const id = selection.editingId();
  const path = id ? resolveEditablePathOf(scene.get(id as NodeId)) : null;
  const { values, mixed } = filletControlsState(path, selection.selectedAnchors());
  return JSON.stringify({ values, mixed: [...mixed] });
}

/**
 * A corner panel over the selected corners of the path open for anchor
 * editing: their shared shape and radius, kept current as the scene or the
 * selection changes, and an `onChange` that writes through `setFillets`.
 */
export function useFilletControls(
  scene: FilletControlsScene,
  selection: FilletControlsSelection,
): UseFilletControlsReturn {
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
    const params = filletControlsParams(field, value);
    if (params) actions?.trigger('setFillets', params);
  }, [actions]);
  const prompt = shown.values.count === 0 ? FILLET_CONTROLS_PROMPT : null;
  return { schema: FILLET_CONTROLS, prompt, ...shown, onChange };
}
