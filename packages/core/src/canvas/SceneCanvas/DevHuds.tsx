/**
 * `<SceneCanvas>`'s dev HUDs: the cursor readout, the pick list, and the
 * modality panel, each a fixed-position widget pinned to the canvas.
 */
import { useCallback, type RefObject } from 'react';
import { useLatest } from '@weasel-js/react';
import type { View } from 'core/viewport/view';
import type { WorldPoint } from '@weasel-js/routing';
import type { DebugConfig } from '../../debug/types';
import type { CanvasExtensionApi } from '../canvasExtension';
import { CursorCoordsHud } from '../CursorCoordsHud';
import { ModalityHud } from '../ModalityHud';
import { PickHud } from '../PickHud';

export interface DevHudsProps {
  cursorCoords: boolean | undefined;
  pick: boolean | undefined;
  /** `true` leaves the mode line at `—`; an object supplies the mode id. */
  modality: boolean | { modeId?: string } | undefined;
  /** The element input comes from. */
  canvasRef: RefObject<HTMLElement | null>;
  /** Read for the canvas's own client→world conversion, so a readout agrees
   *  with a pick. */
  canvasApiRef: RefObject<Pick<CanvasExtensionApi, 'clientToWorld'> | null>;
  /** Under `paintInto`, the caller's input element, `null` until it arrives;
   *  `undefined` when the canvas renders its own. Each HUD of a detached
   *  canvas pins to the input element itself, not to its parent, which every
   *  pane of the shared surface sits in. */
  detachedInput: HTMLElement | null | undefined;
  viewRef: RefObject<View>;
  pickEvery: (world: WorldPoint) => readonly string[];
  /** The id a bare click at this point would select. */
  pickBest: (world: WorldPoint) => string | null;
}

export function DevHuds(props: DevHudsProps) {
  const { cursorCoords, pick, modality, canvasRef, canvasApiRef, detachedInput, viewRef } = props;
  const toWorld = useCallback(
    (clientX: number, clientY: number): [number, number] =>
      canvasApiRef.current?.clientToWorld(clientX, clientY) ?? [clientX, clientY],
    [canvasApiRef],
  );
  // The pick HUD installs its pointer listener again whenever a picker's
  // identity changes, so it gets two that never do.
  const pickersRef = useLatest({ pickEvery: props.pickEvery, pickBest: props.pickBest });
  const pickEvery = useCallback(
    (world: WorldPoint): readonly string[] => pickersRef.current.pickEvery(world),
    [pickersRef],
  );
  const pickBest = useCallback(
    (world: WorldPoint): string | null => pickersRef.current.pickBest(world),
    [pickersRef],
  );

  // `useHostAnchor` resolves its host on mount and again only when the panel
  // or the window moves, so a HUD mounted against a null host would latch off.
  if (detachedInput === null) return null;

  const anchor = detachedInput ? { anchorRef: canvasRef } : {};
  return (
    <>
      {cursorCoords && (
        <CursorCoordsHud canvasRef={canvasRef} {...anchor} viewRef={viewRef} toWorld={toWorld} />
      )}
      {pick && (
        <PickHud
          canvasRef={canvasRef}
          {...anchor}
          viewRef={viewRef}
          toWorld={toWorld}
          pickEvery={pickEvery}
          pickBest={pickBest}
        />
      )}
      {modality && (
        <ModalityHud
          canvasRef={canvasRef}
          {...anchor}
          modeId={typeof modality === 'object' ? modality.modeId : undefined}
        />
      )}
    </>
  );
}

/** `<SceneCanvas debug>` minus the flag only SceneCanvas reads. */
export function canvasDebug(debug: (DebugConfig & { slops?: boolean }) | false): DebugConfig | false {
  if (debug === false) return false;
  const { slops: _slops, ...rest } = debug;
  return rest;
}
