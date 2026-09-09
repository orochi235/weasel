import { useEffect, useMemo, useState } from 'react';
import { SceneCanvas, WeaselProvider, useScene } from '@weasel-js/core';
import {
  EDGE_DERIVE_PATH,
  registerDiagramShape,
  sceneParticipants,
  useLiveLayout,
  withDiagramRegistry,
} from '@weasel-js/diagram';
import { INK, participant, type Data, type Pose, type Spec } from './diagram/shared';

const W = 640, H = 360;
const BOX = { width: 96, height: 32 };
/** Sized for 640×360 rather than for a page. */
const CROWDED = { linkDistance: 90, charge: -900, gravity: 0.06, padding: 14 };

/** A hub and two clusters — enough that a drag on one side visibly reaches the
 *  other. Starting positions are a rough ring, so the first frames are a
 *  relaxation rather than an explosion. */
const NODES = [
  ['hub', 300, 160], ['api', 150, 70], ['db', 150, 250], ['auth', 60, 160],
  ['ui', 460, 70], ['cdn', 520, 160], ['log', 460, 250],
] as const;
const EDGES = [
  ['hub', 'api'], ['hub', 'db'], ['hub', 'ui'], ['hub', 'log'],
  ['api', 'auth'], ['db', 'auth'], ['ui', 'cdn'], ['log', 'cdn'],
];

function DiagramLiveInner() {
  useEffect(() => registerDiagramShape<Pose>(), []);

  const initial = useMemo(() => {
    const specs: Spec[] = NODES.flatMap(([id, x, y]) =>
      participant(id, { x, y, ...BOX }, id));
    for (const [from, to] of EDGES) {
      specs.push({
        kind: 'leaf',
        layer: 'main',
        pose: { x: 0, y: 0, width: 0, height: 0 },
        data: { diagram: { from: {}, to: {} }, stroke: { paint: { color: INK }, width: 2 } },
        dependsOn: [from as never, to as never],
        derivePath: EDGE_DERIVE_PATH as never,
      });
    }
    return specs;
  }, []);

  const registry = useMemo(() => withDiagramRegistry<Pose>(), []);
  const scene = useScene<Data, 'main', Pose>({
    systemLayers: [{ id: 'main' }], initial, registry,
  });

  const source = useMemo(() => sceneParticipants(scene), [scene]);
  // Every frame goes to the scene's override channel, so the edges follow the
  // boxes as they relax; the whole run commits as one undo entry when it
  // settles. Dragging a box needs nothing from this demo: the move tool
  // publishes an override, and the run reads that as a pin.
  const [running, setRunning] = useState(false);
  const live = useLiveLayout<Pose>({
    scene, source, algorithm: 'force', force: CROWDED,
    onSettle: () => setRunning(false),
  });

  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        <button
          type="button"
          className="ckd-btn"
          onClick={() => {
            if (live.isRunning()) live.stop();
            else live.start();
            setRunning(live.isRunning());
          }}
        >
          {running ? 'Settle now' : 'Relax'}
        </button>
        <button
          type="button"
          className="ckd-btn"
          onClick={() => { live.restart(); setRunning(true); }}
        >
          Shake
        </button>
      </div>
      <SceneCanvas width={W} height={H} className="ckd-canvas" scene={scene} />
    </div>
  );
}

export function DiagramLiveDemo() {
  return <WeaselProvider><DiagramLiveInner /></WeaselProvider>;
}
