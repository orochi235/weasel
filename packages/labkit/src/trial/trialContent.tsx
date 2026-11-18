import type { ComponentProps, ReactNode, RefObject } from 'react';
import { CanvasStack } from '../canvas/CanvasStack';
import type { CanvasLayerDescriptor } from '../canvas/useLayerScheduler';
import { DragOverlay, type UseDragDropResult } from '../dragdrop/DragDropRuntime';
import type { Instrument, RenderContext } from '../instrument/types';
import { DEFAULT_VIEW } from '../state/view';
import type { TrialCamera } from './useTrialCamera';

/** What a trial's content is drawn from. */
export interface TrialContentSources {
  instrument: Instrument;
  ctx: RenderContext<unknown, unknown>;
  cam: TrialCamera;
  /** The canvas layers, with any drag's feedback over them. */
  layers: CanvasLayerDescriptor[];
  dragDrop: UseDragDropResult;
  canvasHost: RefObject<HTMLDivElement | null>;
  ticks: ComponentProps<typeof CanvasStack>['ticks'];
  setView: (view: unknown) => void;
}

/**
 * The instrument's output inside whichever camera it declares: a canvas stack with its drop target and drag
 * overlay, another camera's own body, or the bare output. A call, not a component: the instrument's `render` may use
 * hooks, which belong to the trial that calls this.
 */
export function renderTrialContent({
  instrument,
  ctx,
  cam,
  layers,
  dragDrop,
  canvasHost,
  ticks,
  setView,
}: TrialContentSources): ReactNode {
  const { camera, view2d } = cam;
  if (camera?.kind === 'canvas') {
    const canvas = camera.capability;
    return (
      <div ref={canvasHost} className="lk-trial__canvas-host">
        <CanvasStack
          layers={layers}
          view={view2d ?? DEFAULT_VIEW}
          onViewChange={setView}
          worldSpec={canvas.worldSpec}
          onResize={cam.placement.place}
          minZoom={canvas.minZoom}
          maxZoom={canvas.maxZoom}
          ticks={ticks}
          gestures={cam.gestures}
          onHome={cam.home}
        >
          {instrument.render(ctx)}
          {instrument.dragDrop ? dragDrop.target : null}
        </CanvasStack>
        <DragOverlay drag={dragDrop.drag} />
      </div>
    );
  }
  if (camera) return cam.body(instrument.render(ctx), ctx);
  return instrument.render(ctx);
}
