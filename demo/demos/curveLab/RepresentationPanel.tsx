import { useEffect, useMemo, useState } from 'react';
import { SceneCanvas, asNodeId, useScene, useSelection } from '@orochi235/weasel';
import type { DrawCommand } from '../../../src/renderer';
import type { CurveRepresentation, SharedAnchor } from '../../../src/features/paths/curves';
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
  overlays: OverlayFlags;
  width: number;
  height: number;
}

export function RepresentationPanel({ rep, anchors, overlays, width, height }: RepresentationPanelProps) {
  const nodeId = useMemo(() => asNodeId(`curve-${rep.kind}`), [rep.kind]);

  // Build the initial pose once; subsequent updates flow through setPose in
  // the effect below.
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

  // Sync the pose to the latest anchors/rep.
  useEffect(() => {
    scene.setPose(nodeId, rep.toPath(anchors));
  }, [scene, nodeId, rep, anchors]);

  const selection = useSelection({ initial: [nodeId], lock: true });
  const [view, setView] = useState({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  // Stable getter so the layer factories' returned closures don't churn.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const anchorsRef = useMemo(() => ({ current: anchors }), []);
  anchorsRef.current = anchors;
  const getAnchors = useMemo(() => () => anchorsRef.current, [anchorsRef]);

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

  return (
    <div className="curve-lab-panel">
      <div className="curve-lab-panel-title">{rep.label}</div>
      <SceneCanvas
        width={width}
        height={height}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        view={view}
        onViewChange={setView}
        layers={layers as never}
      />
      <ReadoutHud rep={rep} anchors={anchors} />
    </div>
  );
}
