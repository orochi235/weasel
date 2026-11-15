import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ANCHOR_HIT_BASE_PX,
  composeAffordanceLayer,
  SceneCanvas,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type {
  Action,
  ActionsProp,
  Affordance,
  AffordanceRegion,
  InvocationCtx,
  OngoingHandle,
  SceneCanvasApi,
} from '@weasel-js/core';
import type { CurveRepresentation, SharedAnchor } from '@weasel-js/geom/curves';
import { anchorsOf, renderLayerOf, REPS, setAnchors, type CurvePose, type CurveScene } from './curveScene';
import {
  createAnchorsLayer,
  createCurvatureCombLayer,
  createInflectionsLayer,
} from './overlays';
import { ReadoutHud } from './ReadoutHud';
import { DemoStage } from '../DemoStage';

export interface OverlayFlags {
  anchors: boolean;
  comb: boolean;
  inflections: boolean;
}

export interface RepresentationPanelProps {
  rep: CurveRepresentation;
  /** The scene every panel shows, this one through its own curve's layer. */
  scene: CurveScene;
  anchors: SharedAnchor[];
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
  scene,
  anchors,
  overlays,
  width,
  height,
}: RepresentationPanelProps) {
  const layerVisibility = useMemo(
    () => Object.fromEntries(REPS.map((r) => [renderLayerOf(r.kind), r.kind === rep.kind])),
    [rep.kind],
  );
  const getAnchors = useCallback(() => anchorsOf(scene), [scene]);

  const anchorsLayer = useMemo(() => createAnchorsLayer(rep, getAnchors), [rep, getAnchors]);
  const combLayer = useMemo(() => createCurvatureCombLayer(rep, getAnchors), [rep, getAnchors]);
  const inflectionsLayer = useMemo(() => createInflectionsLayer(rep, getAnchors), [rep, getAnchors]);

  const layers = {
    scene: {
      drawOne: (_n: unknown, p: CurvePose): DrawCommand[] => [{
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
    regions: (): AffordanceRegion[] => anchorsOf(scene).map((a, i) => ({
      id: `anchor-${i}`,
      targetId: null,
      shape: { kind: 'point', x: a.x, y: a.y, hitRadiusPx: ANCHOR_HIT_BASE_PX },
      cursor: 'grab',
      strength: 'exclusive',
      claimedKinds: ['pointer'],
      bind: () => ({ initialScratch: { anchorIndex: i } satisfies AnchorScratch }),
    })),
  }), [scene, layerId]);

  const anchorLayer = useMemo(
    () => composeAffordanceLayer(layerId, 'Curve anchor handles', [anchorHandles]),
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
        const origin = index === null ? undefined : anchorsOf(scene)[index];
        if (index === null || !origin) return {};
        const from = ctx.drag!.start;
        // Every move goes to the journal, and its commit leaves one entry: the drag is one undo step.
        const journal = scene.history.beginJournal({ label: 'Move anchor' });
        const to = (at: InvocationCtx) => {
          setAnchors(scene, anchorsOf(scene).map((a, i) => (
            i === index
              ? { ...a, x: origin.x + (at.world.x - from.x), y: origin.y + (at.world.y - from.y) }
              : a
          )));
        };
        return {
          kind: 'move-curve-anchor',
          onMove: to,
          onEnd: (at, reason) => {
            if (reason !== 'commit') return journal.cancel();
            to(at);
            journal.commit();
          },
        };
      },
    },
  }), [actionId, scene, layerId]);

  const actions = useMemo<ActionsProp>(() => ({
    [actionId]: dragAnchor,
  }), [actionId, dragAnchor]);

  return (
    <div className="curve-lab-panel">
      <div className="curve-lab-panel-title">{rep.label}</div>
      <DemoStage width={width} height={height}>
        <SceneCanvas
          ref={canvasRef}
          className="ckd-canvas"
          scene={scene}
          layerVisibility={layerVisibility}
          actions={actions}
          layers={layers}
        />
      </DemoStage>
      <ReadoutHud rep={rep} anchors={anchors} />
    </div>
  );
}
