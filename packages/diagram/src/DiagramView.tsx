import {
  dragPanContribution,
  fitViewToBounds,
  reconcileSpecs,
  SceneCanvas,
  useLatest,
  useScene,
  useSelection,
  WeaselProvider,
  type FillStyle,
  type RectPose,
  type SceneCanvasApi,
  type View,
} from '@weasel-js/core';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import type { CanConnect } from './connect';
import { diagramPorts, type DiagramContributionOptions } from './contribution';
import { withDiagramRegistry } from './edge';
import type { DataEdge, DiagramSceneData, DiagramSpec } from './fromData';
import type { LayoutFn } from './layout';
import { useLiveLayout, type LiveLayout, type UseLiveLayoutOptions } from './live';
import { useMirroredSelection } from './mirrorSelection';
import { sceneParticipants } from './portLayer';
import { registerDiagramShape } from './shape';

/** Where a moved node now stands. */
export interface NodeMove { id: string; x: number; y: number }

export interface DiagramViewProps {
  /** Every spec needs an id, which `diagramScene` gives them. A new array is
   *  reconciled into the scene the view already holds, so the view, the
   *  selection and anything moved since stay put unless the new specs change
   *  them. Pass a new `key` to start over instead. */
  specs: readonly DiagramSpec[];
  width: number;
  height: number;
  /** A participant id, or null for none. */
  selected?: string | null;
  /** Reports what each click leaves picked, `null` for none — a re-click on the
   *  picked node reports it again. The canvas keeps the pick even if
   *  `selected` does not follow it; only a change to `selected` is pushed in. */
  onSelect?: (id: string | null) => void;
  /** Set to let nodes be dragged. Reports every node a drag or a layout run
   *  moved. Store each as the data node's `at` with `pinned: true`, or the
   *  next `diagramScene` lays it out again. */
  onMove?: (moves: readonly NodeMove[]) => void;
  /** Set to make ports grabbable. Dragging one port onto another reports the
   *  edge it describes and draws nothing; add it to the data to keep it. */
  onConnect?: (edge: DataEdge) => void;
  /** Which ports may be joined. Default: a port may not join itself, and two
   *  typed ports must share a type. */
  canConnect?: CanConnect;
  /** How ports look and answer the pointer, and the router a connect's
   *  preview draws with. */
  portOptions?: Pick<
    DiagramContributionOptions<RectPose>,
    'fill' | 'stroke' | 'sizePx' | 'hitRadiusPx' | 'cursor' | 'shows' | 'snapRadius' | 'router'
  >;
  /** How a layout run from {@link DiagramViewApi.layout} behaves: its forces,
   *  how many frames an eased layout takes, its easing. */
  live?: Omit<UseLiveLayoutOptions<RectPose>, 'scene' | 'source' | 'algorithm'>;
  /** The smallest scale the initial fit may use. Unset, the whole diagram fits
   *  however small that makes it; set, it stops here and the rest is a pan away. */
  minScale?: number;
  /** The largest scale the initial fit may use. Default 1, so a small
   *  diagram opens at its own size rather than blown up. */
  maxScale?: number;
  /** Which part of a diagram too big for the box it opens on: its middle
   *  (default) or its top-left, where a layered flow begins. */
  anchor?: 'center' | 'start';
  /** Space kept clear around the diagram by the initial fit, in CSS pixels.
   *  Default 16. */
  fitPadding?: number;
  /** What the canvas paints behind the diagram. Unset, it is transparent. */
  background?: FillStyle;
  /** The view, controlled. Set it and the initial fit is skipped; pair it
   *  with `onViewChange` or panning does nothing. */
  view?: View;
  /** Every view change, from a pan, a zoom or the initial fit. */
  onViewChange?: (view: View) => void;
  className?: string;
}

/** What a `ref` on `DiagramView` holds. */
export interface DiagramViewApi {
  /** Lay the diagram out again from where its nodes stand, animated. `'force'`
   *  (default) relaxes until it settles; any other layout eases to its answer.
   *  What moved is reported to `onMove` once the run settles. */
  layout(algorithm?: 'layered' | 'tree' | 'force' | LayoutFn): void;
  /** The run `layout` started: stop it where it stands, or cancel it. */
  live: LiveLayout;
}

const AMBIENT = [dragPanContribution()];

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
  specs, width, height, selected, onSelect, onMove, onConnect, canConnect, portOptions, live: liveOpts,
  minScale, maxScale, anchor, fitPadding, background, view, onViewChange, className, apiRef,
}: DiagramViewProps & { apiRef: Ref<DiagramViewApi> }) {
  useEffect(() => registerDiagramShape<RectPose>(), []);
  const registry = useMemo(() => withDiagramRegistry<RectPose>(), []);
  const scene = useScene<DiagramSceneData, 'main', RectPose>({
    systemLayers: [{ id: 'main' }],
    initial: specs as DiagramSpec[],
    registry,
  });
  const selection = useSelection({ scene, mode: 'single' });
  const onClick = useMirroredSelection(selection, selected, onSelect);

  const onMoveRef = useLatest(onMove);
  const syncing = useRef(false);
  const applied = useRef(specs);
  const known = useRef<Map<string, { x: number; y: number }>>(new Map());
  useEffect(() => {
    const read = () => {
      const out = new Map<string, { x: number; y: number }>();
      for (const n of scene.renderOrderNodes()) {
        if (n.kind === 'container') out.set(n.id, { x: n.pose.x, y: n.pose.y });
      }
      return out;
    };
    known.current = read();
    return scene.subscribe(() => {
      const now = read();
      const moves: NodeMove[] = [];
      if (!syncing.current) {
        for (const [id, at] of now) {
          const was = known.current.get(id);
          if (was !== undefined && (was.x !== at.x || was.y !== at.y)) moves.push({ id, ...at });
        }
      }
      known.current = now;
      if (moves.length > 0) onMoveRef.current?.(moves);
    });
  }, [scene, onMoveRef]);
  useEffect(() => {
    if (applied.current === specs) return;
    syncing.current = true;
    try {
      reconcileSpecs(scene, applied.current as DiagramSpec[], specs as DiagramSpec[]);
    } finally {
      syncing.current = false;
    }
    applied.current = specs;
  }, [scene, specs]);

  const source = useMemo(() => sceneParticipants<RectPose>(scene), [scene]);
  // Each `layout()` call is a new run: the state change lands the algorithm in
  // the live layout's options before the effect restarts it.
  const [run, setRun] = useState<{ algorithm: 'layered' | 'tree' | 'force' | LayoutFn } | null>(null);
  const live = useLiveLayout<RectPose>({ ...liveOpts, scene, source, algorithm: run?.algorithm ?? 'force' });
  useEffect(() => {
    if (run !== null) live.restart();
  }, [run, live]);
  useImperativeHandle(apiRef, () => ({
    layout: (algorithm = 'force') => setRun({ algorithm }),
    live,
  }), [live]);

  const onConnectRef = useLatest(onConnect);
  const connecting = onConnect !== undefined;
  const ports = useMemo(() => connecting
    ? diagramPorts<RectPose>({
        ...portOptions,
        participants: source,
        ...(canConnect ? { canConnect } : {}),
        commit: ({ from, to }) => onConnectRef.current?.({
          from: from.nodeId, fromPort: from.id, to: to.nodeId, toPort: to.id,
        }),
      })
    : null, [connecting, source, canConnect, portOptions, onConnectRef]);
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  useEffect(() => (ports ? canvasRef.current?.registerLayer(ports.layer) : undefined), [ports]);
  const ambient = useMemo(() => (ports ? [...AMBIENT, ports.contribution] : AMBIENT), [ports]);

  const controlled = view !== undefined;
  const defaultView = useMemo(
    () => controlled
      ? undefined
      : fitDiagram(specs, { width, height }, { minScale, maxScale, anchor, padding: fitPadding }),
    // The fit is where the view opens; a later `specs` keeps the view it has.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controlled, width, height, minScale, maxScale, anchor, fitPadding],
  );
  return (
    <SceneCanvas
      ref={canvasRef}
      scene={scene}
      selection={selection}
      features={onMove ? ['view', 'pick', 'move'] : ['view', 'pick']}
      ambient={ambient}
      onClick={onClick}
      width={width}
      height={height}
      className={className}
      {...(defaultView ? { defaultView } : {})}
      {...(view ? { view } : {})}
      {...(onViewChange ? { onViewChange } : {})}
      {...(background ? { backgroundFill: background } : {})}
    />
  );
}

/** How `fitDiagram` frames a diagram in its box. */
export interface DiagramFit {
  minScale?: number;
  maxScale?: number;
  anchor?: 'center' | 'start';
  padding?: number;
}

/** The view `DiagramView` opens on: every container in the box, never above
 *  `maxScale` (default 1) and never below `minScale`. */
export function fitDiagram(
  specs: readonly DiagramSpec[],
  size: { width: number; height: number },
  fit: DiagramFit = {},
): View | undefined {
  const boxes = specs.filter((s) => s.kind === 'container').map((s) => s.pose as RectPose);
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
