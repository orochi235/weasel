import { useEffect, useMemo, useRef, useState } from 'react';
import { SceneCanvas, asNodeId, useScene, useSelection } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { CurveRepresentation, SharedAnchor } from '@weasel-js/core';
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

const HIT_SLOP = 10;

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

  // Anchor drag: identity view, so world coords == element-relative pixels.
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ idx: number; sx: number; sy: number; ax: number; ay: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const d = Math.hypot(anchors[i].x - sx, anchors[i].y - sy);
      if (d < HIT_SLOP && d < bestD) { bestD = d; best = i; }
    }
    if (best >= 0) {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { idx: best, sx, sy, ax: anchors[best].x, ay: anchors[best].y };
      setDragging(true);
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dx = (e.clientX - rect.left) - drag.sx;
    const dy = (e.clientY - rect.top) - drag.sy;
    onAnchorsChange(anchors.map((a, i) =>
      i === drag.idx ? { ...a, x: drag.ax + dx, y: drag.ay + dy } : a,
    ));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragging(false);
  };

  return (
    <div className="curve-lab-panel">
      <div className="curve-lab-panel-title">{rep.label}</div>
      <div
        className={`curve-lab-canvas-wrap${dragging ? ' is-dragging' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <SceneCanvas
          width={width}
          height={height}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          defaultTools={['select']}
          actions={{ enterPathEdit: null, exitPathEdit: null, insertPathAnchor: null }}
          layers={layers as never}
        />
      </div>
      <ReadoutHud rep={rep} anchors={anchors} />
    </div>
  );
}
