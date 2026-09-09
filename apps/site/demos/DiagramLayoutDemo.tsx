import { useEffect, useMemo } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  useAction,
  useActionsRegistry,
  useScene,
  type Action,
} from '@weasel-js/core';
import {
  EDGE_DERIVE_PATH,
  registerDiagramShape,
  createLayoutAction,
  force,
  layered,
  sceneParticipants,
  tree,
  withDiagramRegistry,
  type LayoutFn,
} from '@weasel-js/diagram';
import { INK, participant, type Data, type Pose, type Spec } from './diagram/shared';

const W = 640, H = 360;
const BOX = { width: 140, height: 44 };
/** Tighter than the layout defaults, and force turned down to match: the
 *  shipped numbers are sized for a page, not for 640×360. */
const GAPS = { nodeGap: 32, rankGap: 40 };
const CROWDED = { linkDistance: 80, charge: -400, gravity: 0.08, padding: 16 };

/** A layout is a plain function of the graph, so a consumer tunes one by
 *  wrapping it rather than by configuring the action. */
const CHOICES: { name: string; run: LayoutFn }[] = [
  { name: 'Layered', run: layered },
  { name: 'Tree', run: tree },
  { name: 'Force', run: (graph, opts) => force(graph, { ...opts, ...CROWDED }) },
];

/** Deliberately scattered, and deliberately not in graph order: a layout has
 *  to read where things are, not just how they connect. */
const NODES = [
  { id: 'read', at: { x: 380, y: 40, ...BOX }, text: 'read' },
  { id: 'parse', at: { x: 60, y: 150, ...BOX }, text: 'parse' },
  { id: 'scale', at: { x: 420, y: 200, ...BOX }, text: 'scale' },
  { id: 'write', at: { x: 150, y: 280, ...BOX }, text: 'write' },
];
// A diamond rather than a chain: two nodes share a rank, which is what makes
// within-rank order — and the layouts' differences — visible at all.
const EDGES = [['read', 'parse'], ['read', 'scale'], ['parse', 'write'], ['scale', 'write']];

function DiagramLayoutInner() {
  // The painter for a node whose trait names an outline.
  useEffect(() => registerDiagramShape<Pose>(), []);

  const initial = useMemo(() => {
    const specs: Spec[] = NODES.flatMap((n) => participant(n.id, n.at, n.text));
    for (const [from, to] of EDGES) {
      specs.push({
        kind: 'leaf',
        layer: 'main',
        pose: { x: 0, y: 0, width: 0, height: 0 },
        data: {
          diagram: { from: {}, to: {}, router: 'orthogonal' },
          stroke: { paint: { color: INK }, width: 2, markerEnd: 'arrow' },
        },
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

  // The graph is rebuilt from the scene on each press, so nothing here has to
  // be kept in sync with what the author has dragged since the last one — and
  // a box dragged past its neighbor keeps the order it was dragged into.
  const source = useMemo(() => sceneParticipants(scene), [scene]);
  const layouts = useMemo(() => CHOICES.map(({ name, run }) => createLayoutAction<Pose>({
    id: `diagram.layout.${name.toLowerCase()}`,
    label: name,
    source,
    algorithm: run,
    layout: GAPS,
  })), [source]);

  return (
    <div className="ckd-stack">
      <div className="ckd-row">
        {layouts.map((action) => <LayoutButton key={action.id} action={action} />)}
      </div>
      <SceneCanvas width={W} height={H} className="ckd-canvas" scene={scene} />
    </div>
  );
}

/** Registers one layout action and gives it a press. Dispatched through the
 *  registry rather than called directly, so the button runs the same path a
 *  keybinding would. */
function LayoutButton({ action }: { action: Action }) {
  useAction(action);
  const actions = useActionsRegistry();
  return (
    <button type="button" className="ckd-btn" onClick={() => actions?.trigger(action.id)}>
      {action.label}
    </button>
  );
}

export function DiagramLayoutDemo() {
  return <WeaselProvider><DiagramLayoutInner /></WeaselProvider>;
}
