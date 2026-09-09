import { useEffect, useMemo, useRef } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  useAction,
  useActionsRegistry,
  useScene,
  type Action,
  type AddNodeSpec,
  type SceneCanvasApi,
} from '@weasel-js/core';
import {
  EDGE_DERIVE_PATH,
  bodyTrait,
  createLayoutAction,
  diagramPorts,
  force,
  layered,
  layoutBody,
  measureBody,
  registerDiagramShape,
  sceneParticipants,
  sizeToBody,
  tree,
  withDiagramRegistry,
  type BodySpec,
  type DiagramEdge,
  type DiagramNode,
  type LayoutFn,
} from '@weasel-js/diagram';

const W = 640, H = 360;
/** Tighter than the layout defaults, so three ranks fit a 360px demo canvas. */
const GAPS = { nodeGap: 32, rankGap: 40 };

/** A layout is a plain function of the graph, so a consumer tunes one by
 *  wrapping it rather than by configuring the action. Force is turned down
 *  here for the same reason the gaps are: the shipped numbers are sized for a
 *  page, not for 640×360. */
const CHOICES: { name: string; run: LayoutFn }[] = [
  { name: 'Layered', run: layered },
  { name: 'Tree', run: tree },
  { name: 'Force', run: (graph, opts) => force(graph, { ...opts, linkDistance: 80, charge: -400, gravity: 0.08, padding: 16 }) },
];
const INK = '#7ba7c7';
const PORT = '#e0913f';

interface Data {
  diagram?: DiagramNode | DiagramEdge;
  fill?: { color: string };
  stroke?: { paint: { color: string }; width: number };
  text?: string;
  style?: { fontFamily: string; fontSize: number };
}
interface Pose { x: number; y: number; width: number; height: number }

/** Each edge names its two ends and how it wants to be routed. */
const EDGES: { from: string; to: string; router: string }[] = [
  { from: 'start', to: 'check', router: 'straight' },
  { from: 'check', to: 'load', router: 'bezier' },
  { from: 'scale', to: 'load', router: 'orthogonal' },
];

const BUILT: { id: string; at: Pose; spec: BodySpec }[] = [
  {
    id: 'start',
    at: { x: 40, y: 40, width: 150, height: 56 },
    spec: { outline: 'stadium', rows: [{ kind: 'label', text: 'start' }] },
  },
  {
    id: 'check',
    at: { x: 250, y: 30, width: 170, height: 90 },
    spec: { outline: 'diamond', rows: [{ kind: 'label', text: 'ready?' }] },
  },
  {
    id: 'scale',
    at: { x: 60, y: 170, width: 150, height: 40 },
    spec: {
      outline: 'rect',
      rows: [
        { kind: 'label', text: 'scale' },
        { kind: 'ports', left: [{ id: 'in', label: 'in' }], right: [{ id: 'out', label: 'out' }], height: 28 },
        { kind: 'field', label: 'by', value: '2.0' },
      ],
    },
  },
  {
    id: 'load',
    at: { x: 300, y: 190, width: 170, height: 50 },
    spec: { outline: 'parallelogram', rows: [{ kind: 'label', text: 'read frame' }] },
  },
];

function DiagramNodesInner() {
  // `registerDiagramShape` is what draws a node whose trait names an outline.
  // Registration is ambient and bumps the painter memo, so it belongs in an
  // effect with its disposer, not in render.
  useEffect(() => registerDiagramShape<Pose>(), []);

  const initial = useMemo(() => {
    const specs: AddNodeSpec<Data, 'main', Pose>[] = [];
    for (const { id, at, spec } of BUILT) {
      // The body measures a floor; the authored pose is grown to clear it and
      // otherwise left alone.
      const pose = sizeToBody(at, measureBody(spec));
      specs.push({
        id: id as never,
        kind: 'container',
        layer: 'main',
        pose,
        data: {
          diagram: bodyTrait(spec, pose),
          fill: { color: '#16222c' },
          stroke: { paint: { color: INK }, width: 2 },
        },
      });
      // Rows are ordinary scene nodes, so the kit's own text painter draws
      // them and text editing and styling work on them unchanged. `layoutBody`
      // is what says where each one goes — the same walk `bodyTrait` anchors
      // its row ports against, so a label and its ports cannot drift apart.
      for (const box of layoutBody(spec, pose)) {
        const row = box.row;
        if (row.kind !== 'label' && row.kind !== 'field') continue;
        specs.push({
          kind: 'leaf',
          layer: 'main',
          parent: id as never,
          pose: { x: box.x, y: box.y, width: box.width, height: box.height },
          data: {
            text: row.kind === 'label' ? row.text : `${row.label}: ${row.value}`,
            style: { fontFamily: 'sans-serif', fontSize: 13 },
            fill: { color: '#dbe7f2' },
          },
        });
      }
    }
    // An edge is an ordinary leaf node: `dependsOn` names its two ends, and
    // `derivePath` re-routes whenever either of them moves. Nothing here draws
    // it — the kit's own derived-path painter does.
    for (const e of EDGES) {
      specs.push({
        kind: 'leaf',
        layer: 'main',
        pose: { x: 0, y: 0, width: 0, height: 0 },
        data: {
          diagram: { from: {}, to: {}, router: e.router },
          stroke: { paint: { color: INK }, width: 2 },
        },
        dependsOn: [e.from as never, e.to as never],
        derivePath: EDGE_DERIVE_PATH as never,
      });
    }
    return specs;
  }, []);

  // `withDiagramRegistry` is what lets an edge round-trip through `toJSON`:
  // a function cannot be serialized, so the scene stores the key instead.
  const registry = useMemo(() => withDiagramRegistry<Pose>(), []);
  const scene = useScene<Data, 'main', Pose>({
    systemLayers: [{ id: 'main' }], initial, registry,
  });

  // The ports are declared as affordances, so the kit's own region walk gives
  // them hover, a hit-test and an exclusive claim on the press. `diagramPorts`
  // returns both halves because either alone fails silently: the layer without
  // the contribution paints ports that start no gesture, and the contribution
  // without the layer binds a hit nothing reports.
  const { layer, contribution } = useMemo(() => diagramPorts({
    participants: sceneParticipants(scene),
    fill: { color: PORT },
    cursor: 'crosshair',
    router: 'bezier',
  }), [scene]);

  // `registerLayer` is the only attach route that is hit-tested — the `layers`
  // prop and a `Contribution.overlay` are painted and never hit.
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  useEffect(() => canvasRef.current?.registerLayer(layer), [layer]);

  // One action per algorithm, over the same participant source the ports read.
  // The graph is rebuilt from the scene on each press, so nothing here has to
  // be kept in sync with what the author has since connected or dragged, and a
  // node the author dragged keeps the order it was dragged into.
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
      <SceneCanvas
        ref={canvasRef}
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        ambient={[contribution]}
      />
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

export function DiagramNodesDemo() {
  return <WeaselProvider><DiagramNodesInner /></WeaselProvider>;
}
