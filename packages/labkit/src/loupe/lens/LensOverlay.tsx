import {
  commitDeleteToScene,
  createDeleteAction,
  effectivePose,
  ellipsePath,
  type NodeId,
  type NodeShapeEntry,
  type RectPose,
  rectPath,
  registerNodeShape,
  SceneCanvas,
  type SceneCanvasApi,
  type View,
  WeaselProvider,
} from '@weasel-js/core';
import { useLatest } from '@weasel-js/react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal, flushSync } from 'react-dom';
import { useSurfaceCanvas, useSurfaceOptional } from '../../surface/useSurfaceTile';
import { HANDLE_SLOP, hitBoxesOf, type LensHitBox } from './lensHitBoxes';
import { LensChrome } from './LensChrome';
import { LensSlot } from './LensSlot';
import { lensClosure, lensesOf, lensIdsOf, settingsOf } from './lensScene';
import type { LensSources } from './lensSource';
import type { LensIds, LensNodeData, LensScene, LoupePoint } from './lensTypes';

/** The camera a lens scene is drawn and picked through, in the px of the
 *  layer the lens canvas covers. */
export interface LensAttachment {
  /** A cached snapshot: the same object until the view changes, and a new one
   *  when it does. It is read as a `useSyncExternalStore` snapshot, so a fresh
   *  object on every call re-renders forever. */
  view(): View;
  subscribe(listener: () => void): () => void;
}

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

/** Lenses stay put in lab-body px, whatever any trial's camera does. */
export const VIEWPORT_ATTACHMENT: LensAttachment = {
  view: () => IDENTITY,
  subscribe: () => () => {},
};

/** Props for `<LensOverlay>`. */
export interface LensOverlayProps<C> {
  /** The host owns it, and so owns whether it outlives the overlay. */
  scene: LensScene<C>;
  /** Default {@link VIEWPORT_ATTACHMENT}. A host attaching lenses to a pane
   *  passes that pane's camera. */
  attachment?: LensAttachment;
  /** What each lens can show inside its body. Without them no lens shows a render. */
  sources?: LensSources<C>;
  /** Names a comparison on the lens chrome. Default `String`. */
  describe?: (compare: C) => string;
  /** The lens the selection is on, or null when nothing is selected. */
  onFocusLens?: (lensId: string | null) => void;
}

const TILE = 'lab-loupe';
const RIM_PX = 2;

interface LensColors {
  rim: string;
  reticle: string;
}

function cssVar(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

type LensNode = { layer: string; data: LensNodeData<unknown> };
const isRole = (node: unknown, role: LensNodeData<unknown>['role']): boolean =>
  (node as LensNode).layer === 'lenses' && (node as LensNode).data?.role === role;

/** How each node of a lens draws and picks. A body and a reticle are picked by
 *  their whole silhouette; a leader is drawn and never picked. */
function lensShapes(colors: LensColors): NodeShapeEntry<LensNodeData<unknown>, RectPose>[] {
  const ring = (color: string) => ({ paint: { color }, width: { px: RIM_PX } });
  const outline = (node: { data: LensNodeData<unknown> }, p: RectPose) =>
    node.data.role === 'lens-body' && node.data.shape === 'square'
      ? rectPath(p.x, p.y, p.width, p.height)
      : ellipsePath(p);
  return [
    {
      id: 'labkit:lens-body',
      matches: (node) => isRole(node, 'lens-body'),
      paint: (node, p) => [{ kind: 'path', path: outline(node, p), stroke: ring(colors.rim) }],
      silhouette: (node, p) => outline(node, p),
    },
    {
      id: 'labkit:lens-reticle',
      matches: (node) => isRole(node, 'lens-reticle'),
      paint: (_node, p) => [{ kind: 'path', path: ellipsePath(p), stroke: ring(colors.reticle) }],
      silhouette: (_node, p) => ellipsePath(p),
    },
    {
      id: 'labkit:lens-leader',
      matches: (node) => isRole(node, 'lens-leader'),
      paint: (_node, _p, ctx) =>
        ctx?.derivedPath ? [{ kind: 'path', path: ctx.derivedPath, stroke: ring(colors.rim) }] : [],
      silhouette: () => null,
    },
  ];
}

const sameSize = (a: { w: number; h: number } | null, b: { w: number; h: number }) =>
  a !== null && a.w === b.w && a.h === b.h;

function boxStyle(rect: { x: number; y: number; w: number; h: number }): CSSProperties {
  // A measured rect has nowhere to live but the element's own style; set as
  // custom properties, which the stylesheet reads.
  return {
    ['--lk-lens-x' as string]: `${rect.x}px`,
    ['--lk-lens-y' as string]: `${rect.y}px`,
    ['--lk-lens-w' as string]: `${rect.w}px`,
    ['--lk-lens-h' as string]: `${rect.h}px`,
  } as CSSProperties;
}

function LensInterior<C>({
  lens,
  rect,
  reticle,
  scene,
  sources,
  describe,
}: {
  lens: LensIds;
  rect: LensHitBox['rect'];
  reticle: LoupePoint;
  scene: LensScene<C>;
  sources: LensSources<C>;
  describe: (compare: C) => string;
}) {
  const settings = settingsOf(scene, lens.lensId);
  if (!settings) return null;
  const props = {
    lens,
    settings,
    sources,
    reticle,
    size: { width: rect.w, height: rect.h },
    describe,
  };
  return (
    <div className="lk-lens-interior" data-lens={lens.lensId} style={boxStyle(rect)}>
      <LensSlot {...props} />
      <LensChrome {...props} />
    </div>
  );
}

/** A lens's reticle center in client px: its pose through the view, from the layer's own origin. */
function reticleClient<C>(
  scene: LensScene<C>,
  lens: LensIds,
  view: View,
  layer: HTMLElement | null,
): LoupePoint {
  const node = scene.get(lens.reticle);
  if (!node || !layer) return { x: 0, y: 0 };
  const p = effectivePose(scene, node);
  const origin = layer.getBoundingClientRect();
  return {
    x: origin.left + (p.x + p.width / 2 - view.x) * view.scale.x,
    y: origin.top + (p.y + p.height / 2 - view.y) * view.scale.y,
  };
}

/** A body's own rect: its hit box without the slop a selected one grows by. */
function interiorOf(box: LensHitBox, selected: ReadonlySet<string>): LensHitBox['rect'] {
  if (!selected.has(box.nodeId)) return box.rect;
  const { x, y, w, h } = box.rect;
  return { x: x + HANDLE_SLOP, y: y + HANDLE_SLOP, w: w - 2 * HANDLE_SLOP, h: h - 2 * HANDLE_SLOP };
}

/** Hands a wheel over a hit box to whatever lies beneath the lens layer, so a
 *  trial's camera still zooms under a lens. The lens itself binds no wheel. */
function useWheelPassThrough(input: HTMLElement | null, layer: HTMLElement | null) {
  useEffect(() => {
    if (!input || !layer) return;
    const onWheel = (e: WheelEvent): void => {
      // Hit boxes are the only part of the layer that takes input; with them
      // stood down for one hit-test, the point lands on what is beneath.
      layer.dataset.probe = '';
      const beneath = document.elementFromPoint(e.clientX, e.clientY);
      delete layer.dataset.probe;
      if (!beneath || layer.contains(beneath)) return;
      e.stopPropagation();
      const copy = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        composed: true,
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        deltaZ: e.deltaZ,
        deltaMode: e.deltaMode,
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
        buttons: e.buttons,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
      if (!beneath.dispatchEvent(copy)) e.preventDefault();
    };
    input.addEventListener('wheel', onWheel, { passive: false });
    return () => input.removeEventListener('wheel', onWheel);
  }, [input, layer]);
}

/** Registers the lens tile on the layer and keeps the layer's size, which is
 *  the canvas's, current with every frame the surface paints. */
function useLensTile(layer: HTMLElement | null, redraw: () => void) {
  const surface = useSurfaceOptional();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!surface || !layer) return;
    surface.registerTile(TILE, layer);
    return () => surface.registerTile(TILE, null);
  }, [surface, layer]);
  useEffect(
    () =>
      surface?.registerPainter(TILE, (rect) => {
        const next = { w: rect.w, h: rect.h };
        // Committed before the redraw: the renderer reads its size from the
        // last render, and a redraw landing first paints at the old one.
        flushSync(() => setSize((prev) => (sameSize(prev, next) ? prev : next)));
        redraw();
      }),
    [surface, redraw],
  );
  return { container: surface?.getContainer() ?? null, size };
}

/**
 * The lab's lenses: a scene painted into the surface's `top` buffer, on a
 * layer covering the whole surface container. The layer and its input element
 * take no input; each body and reticle has a hit box inside the input element
 * that does, so a press on a lens bubbles to the dispatcher and a press
 * anywhere else falls through to the trials.
 */
export function LensOverlay<C>({
  scene,
  attachment = VIEWPORT_ATTACHMENT,
  sources,
  describe = String,
  onFocusLens,
}: LensOverlayProps<C>) {
  const canvas = useSurfaceCanvas('top');
  const [layer, setLayer] = useState<HTMLDivElement | null>(null);
  const [input, setInput] = useState<HTMLDivElement | null>(null);
  const [colors, setColors] = useState<LensColors | null>(null);
  const sceneCanvas = useRef<SceneCanvasApi | null>(null);
  const redraw = useCallback(() => sceneCanvas.current?.requestRedraw(), []);
  const attachSceneCanvas = useCallback((api: SceneCanvasApi | null) => {
    sceneCanvas.current = api;
  }, []);
  const { container, size } = useLensTile(layer, redraw);
  // Read once, from the layer, so the lenses take the theme the lab is in.
  const attachLayer = useCallback((el: HTMLDivElement | null) => {
    setLayer(el);
    if (el) {
      setColors({
        rim: cssVar(el, '--wzl-accent', '#4c8dff'),
        reticle: cssVar(el, '--wzl-fg', '#ffffff'),
      });
    }
  }, []);

  useEffect(() => {
    if (!colors) return;
    const off = lensShapes(colors).map((s) => registerNodeShape(s, { priority: 'high' }));
    redraw();
    return () => {
      for (const u of off) u();
    };
  }, [colors, redraw]);

  useSyncExternalStore(scene.subscribe, scene.getVersion);
  const view = useSyncExternalStore(attachment.subscribe, attachment.view);
  useEffect(() => attachment.subscribe(redraw), [attachment, redraw]);
  const selection = scene.getSelection();
  const selected = new Set(selection);
  const boxes = hitBoxesOf(scene, selected, view);
  useWheelPassThrough(input, layer);

  const focusRef = useLatest(onFocusLens);
  const focused =
    selection[0] === undefined ? null : (lensIdsOf(scene, selection[0])?.lensId ?? null);
  useEffect(() => {
    focusRef.current?.(focused);
  }, [focused, focusRef]);

  const actions = useMemo(
    () => ({
      delete: createDeleteAction({
        commit: (ids, deps) => commitDeleteToScene(lensClosure(scene, ids) as NodeId[], deps),
      }),
    }),
    [scene],
  );

  if (!container) return null;
  const lenses = sources ? lensesOf(scene) : [];
  return createPortal(
    <div ref={attachLayer} className="lk-lens-layer">
      {sources
        ? boxes.map((b) => {
            const lens = b.role === 'lens-body' && lenses.find((l) => l.body === b.nodeId);
            return lens ? (
              <LensInterior
                key={lens.lensId}
                lens={lens}
                rect={interiorOf(b, selected)}
                reticle={reticleClient(scene, lens, view, layer)}
                scene={scene}
                sources={sources}
                describe={describe}
              />
            ) : null;
          })
        : null}
      <div
        ref={setInput}
        className="lk-lens-input"
        role="application"
        aria-label="Lenses"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: role="application" is the interactive case — the dispatcher listens here, and undo and delete keys reach it only with focus.
        tabIndex={0}
      >
        {boxes.map((b) => (
          <div
            key={b.nodeId}
            className="lk-lens-hit"
            data-node={b.nodeId}
            data-round={b.round ? '' : undefined}
            style={boxStyle(b.rect)}
          />
        ))}
      </div>
      {canvas && input && size ? (
        <WeaselProvider isolate>
          <SceneCanvas<LensNodeData<C>, 'lenses', RectPose>
            features={['pick', 'move', 'transform', 'edit']}
            ref={attachSceneCanvas}
            scene={scene}
            width={size.w}
            height={size.h}
            view={view}
            paintInto={{ canvas, x: 0, y: 0 }}
            inputElement={input}
            actions={actions}
          />
        </WeaselProvider>
      ) : null}
    </div>,
    container,
  );
}
