import {
  registerNodeShape,
  SceneCanvas,
  useActiveToolContext,
  WeaselProvider,
} from '@weasel-js/core';
import { type CSSProperties, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useSurfaceCanvas,
  useSurfaceOptional,
  useTileId,
  useTileInScope,
} from '../surface/useSurfaceTile';
import { createMarkDrawOne } from './drawOne';
import type { WorldRect } from './frac';
import { useMarkTools } from './markTools';
import { useOverlayCanvas } from './overlayCanvas';
import { useOverlayPlacement, useOverlayView } from './overlayPlacement';
import { useOverlayTile } from './overlayTile';
import { POINT_MARK_SHAPE } from './paint';
import type { MarkScene } from './store';
import { annotationToolInfo } from './toolMap';
import type { AnnotationData, AnnotationMeaning, AnnotationTarget } from './types';
import { useWheelHandOff } from './wheelScroll';

export { insertedGeometry } from './markTools';

/** Props for `<AnnotationOverlay>`. */
export interface AnnotationOverlayProps {
  target: AnnotationTarget;
  /** The trial's mark scene — shared by every target; a mark's own `target`
   *  field is what separates them. */
  scene: MarkScene;
  /** Snapshotted onto each new mark, so staleness can be answered later. */
  config: unknown;
  /** The trial's resolved tool slot. */
  activeToolId: string | null;
  /** The instrument's vocabulary, for a status's color. */
  meaning?: AnnotationMeaning;
}

/** Pushes the trial's tool into the weasel scope this pane owns. Its own
 *  component because the context only exists below `<WeaselProvider>`. */
function ToolBridge({ toolId }: { toolId: string }) {
  const tools = useActiveToolContext();
  const setActive = tools.setActive;
  useEffect(() => {
    setActive(toolId);
  }, [toolId, setActive]);
  return null;
}

/**
 * One target's drawing surface: a transparent box over the part of the
 * target's element that shows, taking the input, and a `<SceneCanvas>`
 * painting into the lab's shared buffer at that box's rect. Marks are placed
 * against the whole element, so one that runs past a clipping ancestor is cut
 * there, and a target wholly out of sight draws nothing and takes no press.
 *
 * The box is portalled into the surface container because that is what tile
 * rects are measured against; positioning it among the instrument's own DOM
 * would put it in whatever positioning context happened to be there.
 */
export function AnnotationOverlay({
  target,
  scene,
  config,
  activeToolId,
  meaning,
}: AnnotationOverlayProps) {
  const surface = useSurfaceOptional();
  const canvas = useSurfaceCanvas();
  const [input, setInput] = useState<HTMLDivElement | null>(null);
  useEffect(() => registerNodeShape(POINT_MARK_SHAPE, { priority: 'high' }), []);

  const markTools = useMarkTools(target, activeToolId, config);

  const id = target.id;
  // The surface's tile namespace is the whole lab's, and every trial of an
  // instrument declares the same target ids — so the tile is registered under
  // the trial-scoped key, not under `id`.
  const tileId = useTileId(id);
  // Out of scope while another trial is expanded: nothing paints this tile
  // then, and its box would sit over the expanded one.
  const inScope = useTileInScope(tileId);
  useOverlayTile(surface, tileId, target.ref);
  const { attach, redraw } = useOverlayCanvas(surface, tileId, canvas);
  useWheelHandOff(input, target.ref);
  const placement = useOverlayPlacement(surface, tileId, redraw);
  const view = useOverlayView(target, placement, redraw);

  const container = surface?.getContainer() ?? null;
  if (!container || !placement || !view) return null;
  const { visible } = placement;

  const drawOne = createMarkDrawOne({
    content: target.content,
    positionDependsOn: target.positionDependsOn,
    config,
    meaning,
  });

  // A measured rect has nowhere to live but the element's own style. Set as
  // custom properties, which the stylesheet reads — the sanctioned use.
  const box = {
    ['--lk-anno-x' as string]: `${visible.x}px`,
    ['--lk-anno-y' as string]: `${visible.y}px`,
    ['--lk-anno-w' as string]: `${visible.width}px`,
    ['--lk-anno-h' as string]: `${visible.height}px`,
  } as CSSProperties;

  return createPortal(
    <>
      <div
        ref={setInput}
        className="lk-annotate__input"
        data-annotation-target={id}
        // Pass-through while the rail holds a tool that makes no marks, so the
        // instrument under the overlay stays clickable.
        data-idle={annotationToolInfo(activeToolId) ? undefined : ''}
        hidden={!inScope || !(visible.width > 0 && visible.height > 0)}
        role="application"
        aria-label={`Annotations on ${id}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" IS the interactive case — a region with its own keymap. The rule's allowed-role list stops at the native widget roles and does not include it, and the gesture dispatcher listens on this element, so without focus no tool's keyboard binding ever fires.
        tabIndex={0}
        style={box}
      />
      {canvas && input ? (
        // Isolated so each pane keeps its own selection and tool.
        <WeaselProvider isolate>
          <ToolBridge toolId={annotationToolInfo(activeToolId)?.weaselTool ?? 'select'} />
          <SceneCanvas<AnnotationData, 'marks', WorldRect>
            ref={attach}
            scene={scene}
            width={visible.width}
            height={visible.height}
            view={view}
            paintInto={{ canvas, x: visible.x, y: visible.y }}
            inputElement={input}
            {...markTools}
            layers={{ scene: { drawOne } }}
          />
        </WeaselProvider>
      ) : null}
    </>,
    container,
  );
}
