import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ANCHOR_HIT_BASE_PX,
  SceneCanvas,
  asNodeId,
  composeAffordanceLayer,
  useScene,
  useSelection,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type {
  Action,
  ActionsProp,
  Affordance,
  AffordanceRegion,
  CurveRepresentation,
  InvocationCtx,
  OngoingHandle,
  RenderLayer,
  SceneCanvasApi,
  SharedAnchor,
} from '@weasel-js/core';
import {
  createAnchorsLayer,
  createCurvatureCombLayer,
  createInflectionsLayer,
} from './overlays';
import { ReadoutHud } from './ReadoutHud';

export interface OverlayFlags {
  anchors: boolean;
  comb: boolean;
  inflections: boolean;
}

export interface RepresentationPanelProps {
  rep: CurveRepresentation;
  anchors: SharedAnchor[];
  onAnchorsChange: (next: SharedAnchor[]) => void;
  overlays: OverlayFlags;
  width: number;
  height: number;
}

interface AnchorScratch {
  anchorIndex: number;
}

function anchorIndexOf(hit: { payload?: unknown } | undefined): number | null {
  const scratch = hit?.payload as AnchorScratch | undefined;
  return typeof scratch?.anchorIndex === 'number' ? scratch.anchorIndex : null;
}

export function RepresentationPanel({
  rep,
  anchors,
  onAnchorsChange,
  overlays,
  width,
  height,
}: RepresentationPanelProps) {
  const nodeId = useMemo(() => asNodeId(`curve-${rep.kind}`), [rep.kind]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialPath = useMemo(() => rep.toPath(anchors), []);
  const scene = useScene<{ kind: 'curve' }, 'default', ReturnType<CurveRepresentation['toPath']>>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      id: nodeId,
      kind: 'leaf',
      layer: 'default',
      pose: initialPath,
      data: { kind: 'curve' },
    }],
  });

  useEffect(() => {
    scene.setPose(nodeId, rep.toPath(anchors));
  }, [scene, nodeId, rep, anchors]);

  const selection = useSelection({ initial: [nodeId], lock: true });

  const anchorsRef = useRef(anchors);
  anchorsRef.current = anchors;
  const onAnchorsChangeRef = useRef(onAnchorsChange);
  onAnchorsChangeRef.current = onAnchorsChange;
  const getAnchors = useCallback(() => anchorsRef.current, []);

  const anchorsLayer = useMemo(() => createAnchorsLayer(rep, getAnchors), [rep, getAnchors]);
  const combLayer = useMemo(() => createCurvatureCombLayer(rep, getAnchors), [rep, getAnchors]);
  const inflectionsLayer = useMemo(() => createInflectionsLayer(rep, getAnchors), [rep, getAnchors]);

  const layers = {
    scene: {
      drawOne: (_n: unknown, p: ReturnType<CurveRepresentation['toPath']>): DrawCommand[] => [{
        kind: 'path',
        path: p,
        stroke: { paint: { color: '#7fb069' }, width: 2 },
      } as DrawCommand],
    },
    selectionOverlay: null,
    ...(overlays.anchors ? { anchorsOverlay: { layer: anchorsLayer, after: 'scene' as const } } : {}),
    ...(overlays.comb ? { combOverlay: { layer: combLayer, after: 'scene' as const } } : {}),
    ...(overlays.inflections ? { inflectionsOverlay: { layer: inflectionsLayer, after: 'scene' as const } } : {}),
  };

  // The shared anchors are not the derived path's anchors — NURBS flattens to
  // a polyline, so the kit's path-edit chrome would grab the wrong points.
  // Declaring them as affordance regions instead keeps the hit-test, the
  // exclusive claim and the drag pump on the kit's side of the line.
  const layerId = `curve-lab-anchor-handles-${rep.kind}`;
  const actionId = `curveLab.dragAnchor.${rep.kind}`;

  const anchorHandles = useMemo<Affordance>(() => ({
    id: layerId,
    regions: (): AffordanceRegion[] => anchorsRef.current.map((a, i) => ({
      id: `anchor-${i}`,
      targetId: null,
      shape: { kind: 'point', x: a.x, y: a.y, hitRadiusPx: ANCHOR_HIT_BASE_PX },
      cursor: 'grab',
      strength: 'exclusive',
      claimedKinds: ['pointer'],
      bind: () => ({ initialScratch: { anchorIndex: i } satisfies AnchorScratch }),
    })),
  }), [layerId]);

  // `composeAffordanceLayer` types its data slot as `ChromeState`; the layer
  // registry takes `RenderLayer<unknown>`. Both receive the same live
  // `CanvasHelpers` envelope at runtime.
  const anchorLayer = useMemo(
    () => composeAffordanceLayer(layerId, 'Curve anchor handles', [anchorHandles]) as unknown as RenderLayer<unknown>,
    [layerId, anchorHandles],
  );

  const canvasRef = useRef<SceneCanvasApi | null>(null);
  useEffect(() => canvasRef.current?.registerLayer(anchorLayer), [anchorLayer]);

  const dragAnchor = useMemo<Action>(() => ({
    id: actionId,
    label: 'Drag curve anchor',
    defaultBinding: { kind: 'drag', target: `affordance:layer:${layerId}` },
    activeCursor: 'grabbing',
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx): OngoingHandle {
        const index = anchorIndexOf(ctx.drag?.affordance);
        const origin = index === null ? undefined : anchorsRef.current[index];
        if (index === null || !origin) return {};
        const from = ctx.drag!.start;
        const to = (at: InvocationCtx) => {
          onAnchorsChangeRef.current(anchorsRef.current.map((a, i) => (
            i === index
              ? { ...a, x: origin.x + (at.world.x - from.x), y: origin.y + (at.world.y - from.y) }
              : a
          )));
        };
        return {
          kind: 'move-curve-anchor',
          onMove: to,
          onEnd: (at, reason) => { if (reason === 'commit') to(at); },
        };
      },
    },
  }), [actionId, layerId]);

  const actions = useMemo<ActionsProp>(() => ({
    enterPathEdit: null,
    exitPathEdit: null,
    insertPathAnchor: null,
    [actionId]: dragAnchor,
  }), [actionId, dragAnchor]);

  return (
    <div className="curve-lab-panel">
      <div className="curve-lab-panel-title">{rep.label}</div>
      <SceneCanvas
        ref={canvasRef}
        width={width}
        height={height}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        defaultTools={['select']}
        actions={actions}
        layers={layers as never}
      />
      <ReadoutHud rep={rep} anchors={anchors} />
    </div>
  );
}
