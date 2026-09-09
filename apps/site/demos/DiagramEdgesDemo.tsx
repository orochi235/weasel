import { useEffect, useMemo } from 'react';
import { SceneCanvas, WeaselProvider, useScene } from '@weasel-js/core';
import { EDGE_DERIVE_PATH, registerDiagramShape, withDiagramRegistry } from '@weasel-js/diagram';
import { INK, participant, type Data, type Pose, type Spec } from './diagram/shared';

const W = 640, H = 360;
const BOX = { width: 150, height: 44 };

/** One pair per router, offset on both axes so the three shapes are told
 *  apart by the path rather than by the label. */
const PAIRS = [
  { router: 'straight', y: 24 },
  { router: 'orthogonal', y: 136 },
  { router: 'bezier', y: 248 },
];

function DiagramEdgesInner() {
  // The painter for a node whose trait names an outline.
  useEffect(() => registerDiagramShape<Pose>(), []);

  const initial = useMemo(() => {
    const specs: Spec[] = [];
    for (const { router, y } of PAIRS) {
      specs.push(...participant(`${router}-from`, { x: 40, y, ...BOX }, router));
      specs.push(...participant(`${router}-to`, { x: 400, y: y + 40, ...BOX }, 'to'));
      // An edge is an ordinary leaf node. `dependsOn` names its two ends and
      // `derivePath` runs a router over them, so the path recomputes whenever
      // either end moves — nothing keeps a parallel graph in sync.
      specs.push({
        kind: 'leaf',
        layer: 'main',
        pose: { x: 0, y: 0, width: 0, height: 0 },
        data: {
          diagram: { from: {}, to: {}, router },
          stroke: { paint: { color: INK }, width: 2, markerEnd: 'arrow' },
        },
        dependsOn: [`${router}-from` as never, `${router}-to` as never],
        derivePath: EDGE_DERIVE_PATH as never,
      });
    }
    return specs;
  }, []);

  // `withDiagramRegistry` is what lets an edge round-trip through `toJSON`: a
  // function cannot be serialized, so the scene stores the registry key.
  const registry = useMemo(() => withDiagramRegistry<Pose>(), []);
  const scene = useScene<Data, 'main', Pose>({
    systemLayers: [{ id: 'main' }], initial, registry,
  });

  return <SceneCanvas width={W} height={H} className="ckd-canvas" scene={scene} />;
}

export function DiagramEdgesDemo() {
  return <WeaselProvider><DiagramEdgesInner /></WeaselProvider>;
}
