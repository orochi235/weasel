import {
  SceneCanvas,
  useDepSource,
  useLatest,
  useScene,
  useSelection,
  viewRectToScreen,
  WeaselProvider,
  type FeatureEntry,
  type RectPose,
  type CanvasSize,
  type Scene,
  type SceneCanvasApi,
  type SceneCanvasHit,
} from '@weasel-js/core';
import { adoptCssOnce } from '@weasel-js/react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactElement, type Ref, type RefObject } from 'react';
import { createSpecRouter } from './avoid/specRoutes';
import { diagramCanDropInto, type CanReparent } from './containers/canDropInto';
import { createSpecHops } from './hops/specHops';
import { createSpecLabelPlacer } from './labels/specLabels';
import { useDiagramEditing, withPickableEdges } from './diagramEditing';
import type { DiagramLayout, DiagramViewApi, DiagramViewProps } from './diagramViewProps';
import { withDiagramRegistry } from './edge';
import type { DiagramSceneData, DiagramSpec } from './dataTypes';
import { useHeaderClick } from './headerClick';
import { useHeldImages, useReleasedImages } from './imageRelease';
import { useItemDrop } from './itemDrop';
import { useLiveLayout, type LiveLayout } from './live';
import { usePagesView } from './usePagesView';
import { DEFAULT_FIT_PADDING, diagramViewBounds, useDiagramFit } from './diagramFit';
import { useBatchedEdits } from './batchedEdits';
import { useMirroredSelection } from './mirrorSelection';
import { useOverlayPlacement, worldRectOf } from './overlays';
import { sceneParticipants } from './portLayer';
import { registerMarkShape } from './marks';
import { viewResizable } from './resizable';
import { useSceneSync } from './sceneSync';
import { registerDiagramShape } from './shape';
import { useSequenceTextEdit } from './sequence/textEdit';

const SHAPE_OUTLINE = { outline: { follow: 'shape' as const } };

export type { ContainerEdit, EdgeRoute, NodeMove } from './sceneSync';
export type { DiagramEdit } from './batchedEdits';
export type {
  DeleteReport, DiagramLayout, DiagramViewApi, DiagramViewProps, LabelMove, NodeResize, ReconnectChange, RouteChange,
} from './diagramViewProps';
export type { DiagramOverlay } from './overlays';
export { fitDiagram, type DiagramFit } from './diagramFit';
export type { ReorderChange } from './groupReorder';

/** The view's box holds the canvas and the overlays placed over it, and is as
 *  big as the canvas: its parent's box on an axis the canvas fills. */
const VIEW_RULE = ':where([data-wzl-diagram]) { position: relative; width: fit-content; }'
  + ' :where([data-wzl-diagram~="fill-x"]) { width: 100%; }'
  + ' :where([data-wzl-diagram~="fill-y"]) { height: 100%; }'
  + ' :where([data-wzl-diagram]) > canvas { display: block; }'
  + ' :where([data-wzl-diagram-overlay]) { position: absolute; left: 0; top: 0; }'
  + ' :where([data-wzl-diagram-overlay][hidden]) { display: none; }';

const adoptViewRule = (el: HTMLElement | null) => {
  if (el !== null) adoptCssOnce(el, VIEW_RULE);
};

/** A diagram: drag or wheel to pan, zoom, and pick a node; drag nodes with
 *  `onMove`, join ports with `onConnect`. Every edit is reported, never
 *  written: change the specs to keep it. Labels paint only in a registered
 *  font family; `diagramScene` defaults to sans-serif, so call
 *  `registerCanvasFont('sans-serif')` or text renders blank. */
export const DiagramView = forwardRef<DiagramViewApi, DiagramViewProps>(function DiagramView({ onEdit, ...props }, ref) {
  const reports = useBatchedEdits(props.onMove, props.onEditContainer, onEdit);
  return (
    <WeaselProvider>
      <Inner {...props} {...reports} apiRef={ref} />
    </WeaselProvider>
  );
});

function Inner({
  specs: given, router, labels, hops, width, height, selectionMode = 'single', selected, onSelect, onHeaderClick, onHover, onMove, onResize, onConnect, onReconnect, onEditRoute, onDelete, onEditLabel, onMoveLabel,
  onEditSequence,
  onReorder, onEditContainer, connectBodies, canReparent, onDropItem, canDropItem,
  pickEdges, overlays = NO_OVERLAYS,
  ambient: extraAmbient, tools, onToolsCreated, enableKeybindings, canConnect, portOptions, ports: portMode, live: liveOpts,
  minScale, maxScale, anchor, fitPadding, bounded, refit, background, animator, pages, view, onViewChange, className, apiRef,
}: DiagramViewProps & { apiRef: Ref<DiagramViewApi> }) {
  const edgeEdits = onReconnect !== undefined || onEditRoute !== undefined || onEditLabel !== undefined || onMoveLabel !== undefined;
  const edgesPick = pickEdges ?? (edgeEdits || onDelete !== undefined);
  const avoid = useMemo(() => (router === 'avoid' ? createSpecRouter() : null), [router]);
  const placer = useMemo(() => (labels === 'dodge' ? createSpecLabelPlacer() : null), [labels]);
  const routed = useMemo(() => {
    const out = avoid === null ? given : avoid(given);
    return placer === null ? out : placer(out);
  }, [avoid, placer, given]);
  const hopped = useMemo(() => (hops === undefined ? routed : createSpecHops(hops)(routed)), [hops, routed]);
  const picked = useMemo(() => (edgesPick ? withPickableEdges(hopped) : hopped), [edgesPick, hopped]);
  const specs = useHeldImages(picked);
  useEffect(() => {
    const disposers = [registerDiagramShape<RectPose>(), registerMarkShape<RectPose>()];
    return () => disposers.forEach((dispose) => dispose());
  }, []);
  const registry = useMemo(() => withDiagramRegistry<RectPose>(), []);
  const scene = useScene<DiagramSceneData, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: specs as DiagramSpec[],
    registry,
  });
  const selection = useSelection({ scene, mode: selectionMode === 'multiple' ? 'multi' : 'single' });
  useSceneSync(scene, specs, { onMove, onEditContainer });
  // After the sync, so a `selected` naming a node these specs add finds it in the scene.
  const mirror = useMirroredSelection(selection, selected, onSelect, scene.subscribe);
  useReleasedImages(specs);

  const source = useMemo(() => sceneParticipants<RectPose>(scene), [scene]);
  // Each `layout()` call is a new run: the state change lands the algorithm in
  // the live layout's options before the effect restarts it.
  const [run, setRun] = useState<{ algorithm: DiagramLayout } | null>(null);
  const controlled = view !== undefined;
  const fills = width === undefined || height === undefined;
  const [measured, setMeasured] = useState<CanvasSize | null>(null);
  const { layers: pageLayers, box: pagesBox } = usePagesView(pages);
  const layers = useMemo(() => ({ ...pageLayers, selectionOverlay: SHAPE_OUTLINE }), [pageLayers]);
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const headerHit = useHeaderClick(scene, onHeaderClick);
  const onClick = useCallback((hit: SceneCanvasHit | null) => {
    mirror();
    headerHit(hit);
  }, [mirror, headerHit]);
  const current = useCallback(() => Array.from(source(), ({ node, pose }) => ({ ...node, pose })), [source]);
  const viewBounds = useMemo(
    () => (bounded ? diagramViewBounds(specs, fitPadding ?? DEFAULT_FIT_PADDING, pagesBox) : undefined),
    [bounded, specs, fitPadding, pagesBox],
  );
  const fitting = useDiagramFit({
    canvasRef, specs, current, controlled,
    size: { width: width ?? measured?.width ?? 0, height: height ?? measured?.height ?? 0 },
    fit: { minScale, maxScale, anchor, padding: fitPadding, ...(viewBounds ? { bounds: viewBounds } : {}) }, extra: pagesBox,
    ...(refit ? { refit } : {}),
  });
  const { defaultView } = fitting;
  const settled = useLatest((moved: number) => {
    liveOpts?.onSettle?.(moved);
    if (moved !== 0) fitting.settle();
  });
  const live = useLiveLayout<RectPose>({
    ...liveOpts, scene, source, algorithm: run?.algorithm ?? 'force', onSettle: (moved) => settled.current(moved),
  });
  useEffect(() => {
    if (run !== null) live.restart();
  }, [run, live]);
  useDiagramApi(apiRef, canvasRef, scene, live, setRun, fitting.fitNow);

  const selectedIds = useCallback(() => selection.get() as readonly string[], [selection]);
  const editing = useDiagramEditing({
    scene: scene as never, source, selected: selectedIds, mode: portMode ?? (onConnect !== undefined ? 'connect' : 'none'),
    onConnect, onReconnect, onEditRoute, onDelete, onEditLabel, onMoveLabel, onReorder, onResize, onEditContainer, onMove, onEditSequence,
    connectBodies, canConnect, portOptions, ambient: extraAmbient,
  });
  const itemDrop = useItemDrop(source, { onDropItem, canDropItem });
  const ambient = useMemo(() => (itemDrop === null ? editing.ambient : [...editing.ambient, itemDrop]), [editing.ambient, itemDrop]);
  const moves = onMove !== undefined || onEditContainer !== undefined;
  const resizes = onResize !== undefined || onEditContainer !== undefined;
  const sequences = onEditSequence !== undefined;
  const edits = moves || resizes || sequences || edgeEdits || onDelete !== undefined || onConnect !== undefined || onReorder !== undefined;
  const features = useMemo((): FeatureEntry[] => [
    'view', 'pick', ...(moves ? ['move' as const] : []), ...(resizes ? ['resize' as const] : []), ...(sequences ? ['edit' as const] : []),
    ...editing.presets,
  ], [moves, resizes, sequences, editing.presets]);
  const textEditor = useSequenceTextEdit(scene, onEditSequence);
  const selectTool = useSelectTool(scene, onResize !== undefined, onEditContainer !== undefined);

  const fillsOn = [width === undefined ? 'fill-x' : '', height === undefined ? 'fill-y' : ''].join(' ').trim();
  return (
    <div ref={adoptViewRule} data-wzl-diagram={fillsOn} className={className}>
      <SceneCanvas
        ref={canvasRef}
        scene={scene}
        selection={selection}
        features={features}
        enableKeybindings={enableKeybindings ?? edits}
        ambient={ambient}
        actions={editing.actions}
        onClick={onClick}
        width={width}
        height={height}
        {...setOnly({
          selectTool: resizes ? selectTool : undefined, textEditor, tools, onToolsCreated, onHover,
          onResize: fills ? setMeasured : undefined, defaultView, view, onViewChange, viewBounds,
          backgroundFill: background, animator, layers,
        })}
      >
        <DropRules scene={scene} canReparent={canReparent} />
      </SceneCanvas>
      <Overlays canvasRef={canvasRef} scene={scene} overlays={overlays} />
    </div>
  );
}

/** The select tool's resize handles, on the boxes a callback reports. */
function useSelectTool(scene: Scene<DiagramSceneData, 'main', RectPose>, shapes: boolean, regions: boolean) {
  return useMemo(() => ({ resize: { resizable: viewResizable(scene, { shapes, regions }) } }), [scene, shapes, regions]);
}

/** Each overlay's content, kept over the node it targets. */
function Overlays({ canvasRef, scene, overlays }: {
  canvasRef: RefObject<SceneCanvasApi | null>;
  scene: Scene<DiagramSceneData, 'main', RectPose>;
  overlays: Parameters<typeof useOverlayPlacement>[2];
}): ReactElement {
  const overlayRef = useOverlayPlacement(canvasRef, scene, overlays);
  return (
    <>
      {overlays.map((o) => {
        const key = o.key ?? o.target;
        return <div key={key} ref={overlayRef(key)} data-wzl-diagram-overlay="">{o.content}</div>;
      })}
    </>
  );
}

const NO_OVERLAYS: readonly never[] = [];

/** `props` without the ones left unset, for a canvas whose optional props must be absent rather than undefined. */
function setOnly<T extends object>(props: T): { [K in keyof T]?: Exclude<T[K], undefined | null> } {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) if (value !== undefined && value !== null) out[key] = value;
  return out as { [K in keyof T]?: Exclude<T[K], undefined | null> };
}

/** Shapes drop only into containers and lanes, and lanes only into pools. A child of `<SceneCanvas>`, so its dep source registers after the canvas's own. */
function DropRules({ scene, canReparent }: { scene: Scene<DiagramSceneData, 'main', RectPose>; canReparent: CanReparent | undefined }): null {
  const latest = useLatest(canReparent);
  const asks = canReparent !== undefined;
  const canDropInto = useMemo(
    () => diagramCanDropInto(scene as never, asks ? (ids, into) => latest.current?.(ids, into) ?? true : undefined),
    [scene, asks, latest],
  );
  useDepSource('canDropInto', () => canDropInto);
  return null;
}

/** What a `ref` on the view holds. */
function useDiagramApi(
  apiRef: Ref<DiagramViewApi>,
  canvasRef: RefObject<SceneCanvasApi | null>,
  scene: Scene<DiagramSceneData, 'main', RectPose>,
  live: LiveLayout,
  setRun: (run: { algorithm: DiagramLayout }) => void,
  fitNow: () => void,
): void {
  useImperativeHandle(apiRef, () => ({
    layout: (algorithm = 'force') => setRun({ algorithm }),
    fit: fitNow,
    live,
    worldAt: (clientX, clientY) => {
      const [x, y] = canvasRef.current?.clientToWorld(clientX, clientY) ?? [clientX, clientY];
      return { x, y };
    },
    visible: () => {
      const canvas = canvasRef.current;
      const r = canvas?.element?.getBoundingClientRect();
      if (canvas == null || r === undefined || r.width === 0 || r.height === 0) return null;
      const [x0, y0] = canvas.clientToWorld(r.left, r.top);
      const [x1, y1] = canvas.clientToWorld(r.right, r.bottom);
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    },
    rectOf: (id) => {
      const canvas = canvasRef.current;
      const world = worldRectOf(scene, id);
      const r = canvas?.element?.getBoundingClientRect();
      if (canvas == null || world === null || r === undefined) return null;
      const rect = viewRectToScreen(canvas.getView(), world);
      return { ...rect, x: rect.x + r.left, y: rect.y + r.top };
    },
    subscribeFrame: (fn) => canvasRef.current?.subscribeFrame(() => fn()) ?? (() => {}),
  }), [canvasRef, live, scene, setRun, fitNow]);
}


