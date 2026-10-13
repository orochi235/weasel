/**
 * The path-edit state and its anchor overlay for one canvas surface.
 */
import { useLatest } from '@weasel-js/react';
import { useState } from 'react';
import type { PathEditHost } from 'canvas/SceneCanvas/pathEditHost';
import type { RenderLayer } from 'core/layers/render';
import { rectFromPlane, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import { liveEditablePath, type EditableShape } from './editablePath';
import { createPathEditingOverlayLayer } from './pathEditingOverlayLayer';
import { createPathEditState, type PathEditState } from './pathEditState';

export interface UsePathEditStateOptions {
  /** `<SceneCanvas pathEdit>`. */
  host: PathEditHost | undefined;
  /** See `PathEditSource.isAllowed`; absent when no mode registry is wired. */
  isAllowed: (() => boolean) | undefined;
}

/** One state object for the life of the component, answering from the
 *  options of the last committed render. */
export function usePathEditState(options: UsePathEditStateOptions): PathEditState {
  const live = useLatest(options);
  const [state] = useState(() => createPathEditState({
    host: () => live.current.host,
    isAllowed: () => live.current.isAllowed?.() ?? true,
  }));
  return state;
}

export interface PathEditOverlayInputs {
  /** The committed node for an id, or nothing once it is gone. */
  nodeOf: (id: string) => EditableShape | null | undefined;
  /** How `view`'s world maps into the parallax plane `id` is drawn through. */
  planeOfNode: (id: string, view: View) => PlaneMap | null;
}

/** The anchor overlay for `state`. Built once: it reads `inputs` as of the
 *  last commit and repaints itself when the state changes. */
export function usePathEditOverlayLayer(
  state: PathEditState,
  inputs: PathEditOverlayInputs,
): RenderLayer<unknown> {
  const live = useLatest(inputs);
  const [layer] = useState<RenderLayer<unknown>>(() => ({
    ...createPathEditingOverlayLayer({
      getEditingId: () => state.getEditingId() || null,
      getPose: (id, previews, view) =>
        liveEditablePath(id, live.current.nodeOf(id), previews, live.current.planeOfNode(id, view)),
      getSelectedAnchors: state.getSelectedAnchors,
      // Drawn by an action that ran in the edited path's plane.
      getMarquee: (view) => {
        const rect = state.getMarquee();
        const plane = rect ? live.current.planeOfNode(state.getEditingId(), view) : null;
        return rect && plane ? rectFromPlane(plane, rect) : rect;
      },
    }),
    subscribe: state.subscribe,
  }));
  return layer;
}
