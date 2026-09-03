import {
  type InsertNodeFactory,
  SceneCanvas,
  type SceneCanvasApi,
  useActiveToolContext,
  type View,
  WeaselProvider,
} from '@weasel-js/core';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Rect } from '../surface/rect';
import { useSurfaceCanvas, useSurfaceOptional } from '../surface/useSurfaceTile';
import { createMarkDrawOne } from './drawOne';
import type { WorldRect } from './frac';
import { seenFrom } from './staleness';
import type { MarkScene } from './store';
import { ANNOTATION_WEASEL_TOOLS, annotationToolInfo } from './toolMap';
import type {
  AnnotationData,
  AnnotationKind,
  AnnotationMeaning,
  AnnotationTarget,
  FracPoint,
} from './types';
import { fitView, toWeaselView } from './view';

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
  /** The instrument's vocabulary, for a status's colour. */
  meaning?: AnnotationMeaning;
}

const sameRect = (a: Rect | null, b: Rect): boolean =>
  a !== null && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;

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

/** Every vertex the insert carried, in fractions of the content box. */
function pointsOf(
  extras: Record<string, unknown>,
  content: { w: number; h: number },
): readonly FracPoint[] | undefined {
  const toFrac = (p: { x: number; y: number }): FracPoint => ({
    x: content.w === 0 ? 0 : p.x / content.w,
    y: content.h === 0 ? 0 : p.y / content.h,
  });
  if (extras.kind === 'line') {
    return [toFrac(extras.a as FracPoint), toFrac(extras.b as FracPoint)];
  }
  if (extras.kind === 'pencil') {
    return (extras.samples as { x: number; y: number }[]).map(toFrac);
  }
  return undefined;
}

/**
 * One target's drawing surface: a transparent box over the target's element
 * taking the input, and a `<SceneCanvas>` painting into the lab's shared
 * buffer at that box's rect.
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
  const [rect, setRect] = useState<Rect | null>(null);
  const [input, setInput] = useState<HTMLDivElement | null>(null);
  const sceneCanvas = useRef<SceneCanvasApi | null>(null);

  // Read in the insert factory, which is built once and must see the tool the
  // pane is holding now — `arrow` and `stroke` are indistinguishable from
  // `line` and `pencil` at the weasel end.
  const toolRef = useRef(activeToolId);
  toolRef.current = activeToolId;
  const configRef = useRef(config);
  configRef.current = config;

  const id = target.id;
  const lastTile = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = target.ref.current ?? null;
    if (el === lastTile.current) return;
    lastTile.current = el;
    surface?.registerTile(id, el);
  });
  useEffect(
    () => () => {
      // Clearing this is what lets the effect above re-register on the next
      // commit. StrictMode's mount / unmount / mount would otherwise take the
      // tile out and never put it back, and the surface would measure nothing.
      lastTile.current = null;
      surface?.registerTile(id, null);
    },
    [surface, id],
  );

  useEffect(
    () =>
      surface?.registerPainter(id, (next) => {
        setRect((prev) => (sameRect(prev, next) ? prev : next));
        // The shared buffer was cleared if it resized this frame; this pane's
        // own loop has no way to know that.
        sceneCanvas.current?.requestRedraw();
      }),
    [surface, id],
  );

  const container = surface?.getContainer() ?? null;
  if (!container || !rect) return null;

  const view: View = toWeaselView(target.view ?? fitView(target.content, { w: rect.w, h: rect.h }));

  const drawOne = createMarkDrawOne({
    content: target.content,
    positionDependsOn: target.positionDependsOn,
    config,
    meaning,
  });

  const factories: Record<string, InsertNodeFactory> = {};
  for (const weaselTool of ANNOTATION_WEASEL_TOOLS) {
    factories[weaselTool] = (_bounds, extras) => {
      const info = annotationToolInfo(toolRef.current);
      const kind: AnnotationKind | undefined = info?.kind;
      if (!kind) return null;
      const points = pointsOf(extras as unknown as Record<string, unknown>, target.content);
      const data: AnnotationData = {
        target: id,
        kind,
        ...(points ? { points } : {}),
        seen: seenFrom(configRef.current, target.positionDependsOn ?? []),
      };
      return { data };
    };
  }

  // A measured rect has nowhere to live but the element's own style. Set as
  // custom properties, which the stylesheet reads — the sanctioned use.
  const box = {
    ['--lk-anno-x' as string]: `${rect.x}px`,
    ['--lk-anno-y' as string]: `${rect.y}px`,
    ['--lk-anno-w' as string]: `${rect.w}px`,
    ['--lk-anno-h' as string]: `${rect.h}px`,
  } as CSSProperties;

  return createPortal(
    <>
      <div
        ref={setInput}
        className="lk-annotate__input"
        data-annotation-target={id}
        role="application"
        aria-label={`Annotations on ${id}`}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" IS the interactive case — a region with its own keymap. The rule's allowed-role list stops at the native widget roles and does not include it, and the gesture dispatcher listens on this element, so without focus no tool's keyboard binding ever fires.
        tabIndex={0}
        style={box}
      />
      {canvas && input ? (
        // One scope per pane: a shared <ActionsProvider> lets only the newest
        // canvas under it respond to input, and the rest go silently dead.
        <WeaselProvider isolate>
          <ToolBridge toolId={annotationToolInfo(activeToolId)?.weaselTool ?? 'select'} />
          <SceneCanvas<AnnotationData, 'marks', WorldRect>
            ref={sceneCanvas}
            scene={scene}
            width={rect.w}
            height={rect.h}
            view={view}
            paintInto={{ canvas, x: rect.x, y: rect.y }}
            inputElement={input}
            defaultTools={ANNOTATION_WEASEL_TOOLS}
            insertNodeFactories={factories}
            layers={{ scene: { drawOne } }}
          />
        </WeaselProvider>
      ) : null}
    </>,
    container,
  );
}
