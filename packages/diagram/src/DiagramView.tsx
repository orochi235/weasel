import {
  fitViewToBounds,
  SceneCanvas,
  useLatest,
  useScene,
  useSelection,
  WeaselProvider,
  type RectPose,
  type CanvasSize,
  type SceneCanvasApi,
  type View,
} from '@weasel-js/core';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref, type RefObject } from 'react';
import { useDiagramEditing, withPickableEdges } from './diagramEditing';
import type { DiagramLayout, DiagramViewApi, DiagramViewProps } from './diagramViewProps';
import { withDiagramRegistry } from './edge';
import { diagramGroupOf } from './group';
import type { DiagramSceneData, DiagramSpec } from './fromData';
import { useLiveLayout } from './live';
import { useMirroredSelection } from './mirrorSelection';
import { sceneParticipants } from './portLayer';
import { registerMarkShape } from './marks';
import { useSceneSync } from './sceneSync';
import { registerDiagramShape } from './shape';

export type { EdgeRoute, NodeMove } from './sceneSync';
export type { DeleteReport, DiagramLayout, DiagramViewApi, DiagramViewProps, ReconnectChange } from './diagramViewProps';

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const sameView = (a: View, b: View) =>
  a.x === b.x && a.y === b.y && a.scale.x === b.scale.x && a.scale.y === b.scale.y;

/** A diagram: drag or wheel to pan, zoom, and pick a node; drag nodes with
 *  `onMove`, join ports with `onConnect`. Every edit is reported, never
 *  written: change the specs to keep it. Labels paint only in a registered
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
  specs: given, width, height, selected, onSelect, onMove, onConnect, onReconnect, onDelete, onEditLabel, connectBodies,
  ambient: extraAmbient, enableKeybindings, canConnect, portOptions, ports: portMode, live: liveOpts,
  minScale, maxScale, anchor, fitPadding, background, view, onViewChange, className, apiRef,
}: DiagramViewProps & { apiRef: Ref<DiagramViewApi> }) {
  const edgesPick = onReconnect !== undefined || onDelete !== undefined || onEditLabel !== undefined;
  const specs = useMemo(() => (edgesPick ? withPickableEdges(given) : given), [edgesPick, given]);
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
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  useImperativeHandle(apiRef, () => ({
    layout: (algorithm = 'force') => setRun({ algorithm }),
    live,
    worldAt: (clientX, clientY) => {
      const [x, y] = canvasRef.current?.clientToWorld(clientX, clientY) ?? [clientX, clientY];
      return { x, y };
    },
  }), [live]);

  const selectedIds = useCallback(() => selection.get() as readonly string[], [selection]);
  const editing = useDiagramEditing({
    source, selected: selectedIds, mode: portMode ?? (onConnect !== undefined ? 'connect' : 'none'),
    onConnect, onReconnect, onDelete, onEditLabel, connectBodies, canConnect, portOptions, ambient: extraAmbient,
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const disposers = editing.layers.map((layer) => canvas.registerLayer(layer));
    return () => disposers.forEach((dispose) => dispose());
  }, [editing.layers]);
  const edits = onMove !== undefined || onConnect !== undefined || edgesPick;

  useRefit(canvasRef, fit);
  return (
    <SceneCanvas
      ref={canvasRef}
      scene={scene}
      selection={selection}
      features={onMove ? ['view', 'pick', 'move'] : ['view', 'pick']}
      enableKeybindings={enableKeybindings ?? edits}
      ambient={editing.ambient}
      actions={editing.actions}
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
