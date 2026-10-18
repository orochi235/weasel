import {
  dragPanContribution,
  fitViewToBounds,
  SceneCanvas,
  useLatest,
  useScene,
  useSelection,
  WeaselProvider,
  type Paint,
  type RectPose,
  type CanvasSize,
  type SceneCanvasApi,
  type View,
} from '@weasel-js/core';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref, type RefObject } from 'react';
import type { CanConnect } from './connect';
import { diagramPorts, type DiagramContributionOptions } from './contribution';
import { withDiagramRegistry } from './edge';
import { diagramGroupOf } from './group';
import type { DataEdge, DiagramSceneData, DiagramSpec } from './fromData';
import type { LayoutFn, LayoutPlanner } from './layout';
import { useLiveLayout, type LiveLayout, type UseLiveLayoutOptions } from './live';
import { useMirroredSelection } from './mirrorSelection';
import { portLayer, sceneParticipants } from './portLayer';
import { registerMarkShape } from './marks';
import { useSceneSync, type EdgeRoute, type NodeMove } from './sceneSync';
import { registerDiagramShape } from './shape';

export type { EdgeRoute, NodeMove } from './sceneSync';

/** Props for `DiagramView`. */
export interface DiagramViewProps {
  /** Every spec needs an id, which `diagramScene` gives them. A new array is
   *  reconciled into the scene the view already holds, so the view, the
   *  selection and anything moved since stay put unless the new specs change
   *  them. Pass a new `key` to start over instead. */
  specs: readonly DiagramSpec[];
  /** The view opens fitted to the diagram, and fits again when the size or a
   *  fit option changes or a layout run settles, until the user pans or zooms;
   *  from then on the view is theirs. Omit both to fill the parent, which
   *  then needs a size of its own; a resize of the parent is a size change. */
  width?: number;
  height?: number;
  /** A participant id, or null for none. */
  selected?: string | null;
  /** Reports what each click leaves picked, `null` for none — a re-click on the
   *  picked node reports it again. The canvas keeps the pick even if
   *  `selected` does not follow it; only a change to `selected` is pushed in. */
  onSelect?: (id: string | null) => void;
  /** Set to let nodes be dragged. Reports every node a drag or a layout run
   *  moved, and every edge whose route or ports a layout run rewrote. Store
   *  each move as the data node's `at` with `pinned: true`, and each route as
   *  the data edge's `routed` and `routedPorts`, or the next `diagramScene`
   *  lays them out again. */
  onMove?: (moves: readonly NodeMove[], routes: readonly EdgeRoute[]) => void;
  /** Ports are grabbable when this is set, unless `ports` says otherwise. Dragging one port onto another reports the
   *  edge it describes and draws nothing; add it to the data to keep it. */
  onConnect?: (edge: DataEdge) => void;
  /** Whether ports are drawn. `'connect'` draws them and lets one be dragged
   *  onto another; `'show'` only draws them. Default: `'connect'` when
   *  `onConnect` is set, else `'none'`. */
  ports?: 'connect' | 'show' | 'none';
  /** Whether the canvas's keyboard shortcuts — held Space to pan among them —
   *  run. They listen page-wide, so a view-only diagram beside other UI would
   *  claim keys meant for the page. Default: on when `onMove` or `onConnect`
   *  is set. */
  enableKeybindings?: boolean;
  /** Which ports may be joined. Default: a port may not join itself, and two
   *  typed ports must share a type. */
  canConnect?: CanConnect;
  /** How ports look and answer the pointer, and the router a connect's
   *  preview draws with. */
  portOptions?: Pick<
    DiagramContributionOptions<RectPose>,
    'fill' | 'stroke' | 'shape' | 'sizePx' | 'hitRadiusPx' | 'cursor' | 'shows' | 'showsPort' | 'snapRadius' | 'router'
  >;
  /** How a layout run from {@link DiagramViewApi.layout} behaves: its forces,
   *  how many frames an eased layout takes, its easing, and `onError`, which
   *  hears a `LayoutPlanner` that failed to answer. */
  live?: Omit<UseLiveLayoutOptions<RectPose>, 'scene' | 'source' | 'algorithm'>;
  /** The smallest scale the fit may use. Unset, the whole diagram fits
   *  however small that makes it; set, it stops here and the rest is a pan away. */
  minScale?: number;
  /** The largest scale the fit may use. Default 1, so a small
   *  diagram opens at its own size rather than blown up. */
  maxScale?: number;
  /** Which part of a diagram too big for the box it opens on: its middle
   *  (default) or its top-left, where a layered flow begins. */
  anchor?: 'center' | 'start';
  /** Space kept clear around the diagram by the fit, in CSS pixels.
   *  Default 16. */
  fitPadding?: number;
  /** What the canvas paints behind the diagram. Unset, it is transparent. */
  background?: Paint;
  /** The view, controlled. Set it and the fit is skipped; pair it
   *  with `onViewChange` or panning does nothing. */
  view?: View;
  /** Every view change, from a pan, a zoom or a refit. */
  onViewChange?: (view: View) => void;
  className?: string;
}

/** What a `ref` on `DiagramView` holds. */
export interface DiagramViewApi {
  /** Lay the diagram out again from where its nodes stand, animated. `'force'`
   *  (default) relaxes until it settles; any other layout eases to its answer.
   *  A `LayoutPlanner` is handed the diagram's graph and eased to once it
   *  answers; a drag, an edit or another `layout` call before then drops the
   *  answer. What moved is reported to `onMove` once the run settles. */
  layout(algorithm?: DiagramLayout): void;
  /** The run `layout` started: stop it where it stands, or cancel it. */
  live: LiveLayout;
}

/** What {@link DiagramViewApi.layout} runs. */
export type DiagramLayout = 'layered' | 'tree' | 'force' | 'chain' | LayoutFn | LayoutPlanner;

const AMBIENT = [dragPanContribution()];
const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const sameView = (a: View, b: View) =>
  a.x === b.x && a.y === b.y && a.scale.x === b.scale.x && a.scale.y === b.scale.y;
const NO_MARQUEE = { areaSelect: null };

/** A diagram: drag or wheel to pan, zoom, and pick a node; drag nodes with
 *  `onMove`, join ports with `onConnect`. Labels paint only in a registered
 *  font family; `diagramScene` defaults to sans-serif, so call
 *  `registerCanvasFont('sans-serif')` or text renders blank. */
export const DiagramView = forwardRef<DiagramViewApi, DiagramViewProps>(function DiagramView(props, ref) {
  return (
    <WeaselProvider>
      <Inner {...props} apiRef={ref} />
    </WeaselProvider>
  );
});

function Inner({
  specs, width, height, selected, onSelect, onMove, onConnect, enableKeybindings, canConnect, portOptions, ports: portMode, live: liveOpts,
  minScale, maxScale, anchor, fitPadding, background, view, onViewChange, className, apiRef,
}: DiagramViewProps & { apiRef: Ref<DiagramViewApi> }) {
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
  const selection = useSelection({ scene, mode: 'single' });
  const onClick = useMirroredSelection(selection, selected, onSelect);

  useSceneSync(scene, specs, onMove);

  const source = useMemo(() => sceneParticipants<RectPose>(scene), [scene]);
  // Each `layout()` call is a new run: the state change lands the algorithm in
  // the live layout's options before the effect restarts it.
  const [run, setRun] = useState<{ algorithm: DiagramLayout } | null>(null);
  const controlled = view !== undefined;
  const fills = width === undefined || height === undefined;
  const [measured, setMeasured] = useState<CanvasSize | null>(null);
  const boxWidth = width ?? measured?.width ?? 0;
  const boxHeight = height ?? measured?.height ?? 0;
  // A filling canvas is 0 × 0 until measured, and no box to fit into.
  const unsized = boxWidth === 0 || boxHeight === 0;
  const fitOpts = { minScale, maxScale, anchor, padding: fitPadding };
  const defaultView = useMemo(
    () => controlled || unsized ? undefined : fitDiagram(specs, { width: boxWidth, height: boxHeight }, fitOpts),
    // A later `specs` keeps the view it has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controlled, unsized, boxWidth, boxHeight, minScale, maxScale, anchor, fitPadding],
  );
  // A settled run's fit holds until the box or a fit option changes.
  const [settledFit, setSettledFit] = useState<{ view: View | undefined; over: View | undefined } | null>(null);
  const fit = settledFit !== null && settledFit.over === defaultView ? settledFit.view : defaultView;
  const settled = useLatest((moved: number) => {
    liveOpts?.onSettle?.(moved);
    if (controlled || moved === 0) return;
    const boxes = Array.from(source(), ({ node, pose }) => ({ ...node, pose }));
    setSettledFit({ view: fitDiagram(boxes, { width: boxWidth, height: boxHeight }, fitOpts), over: defaultView });
  });
  const live = useLiveLayout<RectPose>({
    ...liveOpts, scene, source, algorithm: run?.algorithm ?? 'force', onSettle: (moved) => settled.current(moved),
  });
  useEffect(() => {
    if (run !== null) live.restart();
  }, [run, live]);
  useImperativeHandle(apiRef, () => ({
    layout: (algorithm = 'force') => setRun({ algorithm }),
    live,
  }), [live]);

  const onConnectRef = useLatest(onConnect);
  const mode = portMode ?? (onConnect !== undefined ? 'connect' : 'none');
  const ports = useMemo(() => mode === 'connect'
    ? diagramPorts<RectPose>({
        ...portOptions,
        participants: source,
        ...(canConnect ? { canConnect } : {}),
        commit: ({ from, to }) => onConnectRef.current?.({
          from: from.nodeId, fromPort: from.id, to: to.nodeId, toPort: to.id,
        }),
      })
    : null, [mode, source, canConnect, portOptions, onConnectRef]);
  // A registered layer with no `hitTest` is painted and claims no press.
  const shown = useMemo(() => {
    if (mode !== 'show') return null;
    const { hitTest: _hitTest, ...paintOnly } = portLayer<RectPose>(source, portOptions);
    return paintOnly;
  }, [mode, source, portOptions]);
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  const layer = ports?.layer ?? shown;
  useEffect(() => (layer ? canvasRef.current?.registerLayer(layer) : undefined), [layer]);
  const ambient = useMemo(() => (ports ? [...AMBIENT, ports.contribution] : AMBIENT), [ports]);

  useRefit(canvasRef, fit);
  return (
    <SceneCanvas
      ref={canvasRef}
      scene={scene}
      selection={selection}
      features={onMove ? ['view', 'pick', 'move'] : ['view', 'pick']}
      enableKeybindings={enableKeybindings ?? (onMove !== undefined || onConnect !== undefined)}
      ambient={ambient}
      // A drag on empty canvas pans: the select tool's marquee would outrank the ambient pan.
      actions={NO_MARQUEE}
      onClick={onClick}
      width={width}
      height={height}
      {...(fills ? { onResize: setMeasured } : {})}
      className={className}
      {...(defaultView ? { defaultView } : {})}
      {...(view ? { view } : {})}
      {...(onViewChange ? { onViewChange } : {})}
      {...(background ? { backgroundFill: background } : {})}
    />
  );
}

/** Apply each new fit while the view is still the last one applied. */
function useRefit(canvasRef: RefObject<SceneCanvasApi | null>, fit: View | undefined): void {
  const fitted = useRef(fit);
  useEffect(() => {
    const canvas = canvasRef.current;
    const was = fitted.current;
    if (canvas === null || fit === undefined || was === fit) return;
    // A view the user has panned or zoomed off its fit is theirs to keep.
    if (!sameView(canvas.getView(), was ?? IDENTITY)) return;
    fitted.current = fit;
    canvas.setView(fit);
  }, [canvasRef, fit]);
}

/** How `fitDiagram` frames a diagram in its box. */
export interface DiagramFit {
  minScale?: number;
  maxScale?: number;
  anchor?: 'center' | 'start';
  padding?: number;
}

/** The view `DiagramView` opens on: every node box and group box in view, never above
 *  `maxScale` (default 1) and never below `minScale`. Takes specs, or a scene's
 *  nodes at the poses they are drawn at. */
export function fitDiagram(
  specs: readonly { kind: string; pose: unknown; data: unknown }[],
  size: { width: number; height: number },
  fit: DiagramFit = {},
): View | undefined {
  const boxes = specs.filter((s) => s.kind === 'container' || diagramGroupOf(s) !== null).map((s) => s.pose as RectPose);
  if (boxes.length === 0) return undefined;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const bounds = {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
  return fitViewToBounds(bounds, size, { x: 0, y: 0, scale: { x: 1, y: 1 } }, {
    maxScale: fit.maxScale ?? 1,
    ...(fit.minScale !== undefined ? { minScale: fit.minScale } : {}),
    ...(fit.anchor !== undefined ? { anchor: fit.anchor } : {}),
    ...(fit.padding !== undefined ? { padding: fit.padding } : {}),
  });
}
