/**
 * The path-edit state and its anchor overlay for one canvas surface.
 */
import { useLatest } from '@weasel-js/react';
import { useEffect, useMemo, useState } from 'react';
import type { PathEditHost, PathEditOpening } from 'canvas/SceneCanvas/pathEditHost';
import type { RenderLayer } from 'core/layers/render';
import { rectFromPlane, type PlaneMap } from 'core/viewport/parallax';
import type { View } from 'core/viewport/view';
import { liveAnchorMarkers, liveEditablePath, type EditableShape } from './editablePath';
import { createPathEditingOverlayLayer } from './pathEditingOverlayLayer';
import type { PathEditingOverlaySlotConfig } from 'canvas/layerSlots';
import { createPathEditState, type PathEditState } from './pathEditState';
import type { PathEditExtension } from './pathEditExtension';

export interface UsePathEditStateOptions {
  /** `<SceneCanvas pathEdit>`. */
  host: PathEditHost | undefined;
  /** `<SceneCanvas defaultPathEdit>`: what the state starts holding. */
  opening?: PathEditOpening;
  /** See `PathEditSource.isAllowed`; absent when no mode registry is wired. */
  isAllowed: (() => boolean) | undefined;
  isSelectedNode: (id: string) => boolean;
  /** The path-edit extensions the canvas's presets bring. */
  extensions: readonly PathEditExtension[];
}

/** One state object for the life of the component, answering from the
 *  options of the last committed render. */
export function usePathEditState(options: UsePathEditStateOptions): PathEditState {
  const live = useLatest(options);
  const [state] = useState(() => {
    const made = createPathEditState({
      host: () => live.current.host,
      isAllowed: () => live.current.isAllowed?.() ?? true,
      isSelectedNode: (id) => live.current.isSelectedNode(id),
      extensions: options.extensions,
    });
    const { opening } = options;
    if (opening) {
      made.setEditingId(opening.id);
      made.setSelectedAnchors(new Set(opening.anchors ?? []));
    }
    return made;
  });
  useEffect(() => state.setExtensions(options.extensions), [state, options.extensions]);
  return state;
}

export interface PathEditOverlayInputs {
  /** The committed node for an id, or nothing once it is gone. */
  nodeOf: (id: string) => EditableShape | null | undefined;
  /** How `view`'s world maps into the parallax plane `id` is drawn through. */
  planeOfNode: (id: string, view: View) => PlaneMap | null;
}

/** The anchor overlay for `state`, drawn as `config` says. Rebuilt when
 *  `config` changes, so pass a stable one; otherwise it reads `inputs` as of
 *  the last commit and repaints itself when the state changes. */
export function usePathEditOverlayLayer(
  state: PathEditState,
  inputs: PathEditOverlayInputs,
  config?: PathEditingOverlaySlotConfig,
): RenderLayer<unknown> {
  const live = useLatest(inputs);
  return useMemo<RenderLayer<unknown>>(() => ({
    ...createPathEditingOverlayLayer({
      getEditingId: () => state.getEditingId() || null,
      getPose: (id, previews, view) =>
        liveEditablePath(id, live.current.nodeOf(id), previews, live.current.planeOfNode(id, view), state.getExtensions()),
      getAnchorMarkers: (id, previews) => liveAnchorMarkers(id, live.current.nodeOf(id), previews, state.getExtensions()),
      getSelectedAnchors: state.getSelectedAnchors,
      getSelectedMark: state.getSelectedMark,
      getExtensions: state.getExtensions,
      getNode: (id) => live.current.nodeOf(id) ?? null,
      // Drawn by an action that ran in the edited path's plane.
      getMarquee: (view) => {
        const rect = state.getMarquee();
        const plane = rect ? live.current.planeOfNode(state.getEditingId(), view) : null;
        return rect && plane ? rectFromPlane(plane, rect) : rect;
      },
      ...(config?.style ? { style: config.style } : {}),
    }),
    subscribe: state.subscribe,
  }), [state, live, config]);
}
