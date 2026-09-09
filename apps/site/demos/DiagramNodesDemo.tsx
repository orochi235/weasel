import { useEffect, useMemo, useRef } from 'react';
import { SceneCanvas, WeaselProvider, useScene, type SceneCanvasApi } from '@weasel-js/core';
import {
  buildBody,
  diagramPorts,
  registerDiagramShape,
  sceneParticipants,
  withDiagramRegistry,
  type BodySpec,
} from '@weasel-js/diagram';
import { BODY_FILL, INK, LABEL, PORT, TEXT, type Data, type Pose, type Spec } from './diagram/shared';

const W = 640, H = 360;

/** One per outline in the vocabulary, plus the row kinds a body can carry. */
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
    at: { x: 60, y: 180, width: 150, height: 40 },
    spec: {
      outline: 'rect',
      rows: [
        { kind: 'label', text: 'scale' },
        { kind: 'ports', left: [{ id: 'in', label: 'in' }], right: [{ id: 'out', label: 'out' }], height: 24 },
        { kind: 'ports', left: [{ id: 'by', label: 'by' }], height: 24 },
        { kind: 'field', label: 'mode', value: 'bilinear' },
      ],
    },
  },
  {
    id: 'load',
    at: { x: 300, y: 200, width: 170, height: 50 },
    spec: { outline: 'parallelogram', rows: [{ kind: 'label', text: 'read frame' }] },
  },
];

function DiagramNodesInner() {
  // `registerDiagramShape` is what draws a node whose trait names an outline.
  // Registration is ambient and bumps the painter memo, so it belongs in an
  // effect with its disposer, not in render.
  useEffect(() => registerDiagramShape<Pose>(), []);

  // `buildBody` returns the container carrying the trait and one leaf per row
  // that wants drawing. Rows are ordinary scene nodes, so the kit's own text
  // painter draws them and editing and styling work on them unchanged — and
  // the walk that places them is the same one the row ports anchor against, so
  // a label and its ports cannot drift apart.
  const initial = useMemo(() => BUILT.flatMap(({ id, at, spec }) =>
    buildBody<Data, 'main', Pose>(spec, at, {
      id,
      layer: 'main',
      body: (trait) => ({
        diagram: trait,
        fill: { color: BODY_FILL },
        stroke: { paint: { color: INK }, width: 2 },
      }),
      row: (text) => (text === '' ? null : { text, style: TEXT, fill: { color: LABEL } }),
    }).specs as Spec[]), []);

  const registry = useMemo(() => withDiagramRegistry<Pose>(), []);
  const scene = useScene<Data, 'main', Pose>({
    systemLayers: [{ id: 'main' }], initial, registry,
  });

  // Ports are declared as affordances rather than merely painted, so the kit's
  // own region walk gives them their hit-test and their cursor. `diagramPorts`
  // returns both halves because either alone fails quietly: the layer paints
  // ports that start no gesture, and the contribution binds a hit nothing
  // reports. `registerLayer` is the only attach route the kit hit-tests.
  const { layer, contribution } = useMemo(() => diagramPorts({
    participants: sceneParticipants(scene),
    fill: { color: PORT },
    cursor: 'crosshair',
  }), [scene]);
  const canvasRef = useRef<SceneCanvasApi | null>(null);
  useEffect(() => canvasRef.current?.registerLayer(layer), [layer]);

  return (
    <SceneCanvas
      ref={canvasRef}
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      ambient={[contribution]}
    />
  );
}

export function DiagramNodesDemo() {
  return <WeaselProvider><DiagramNodesInner /></WeaselProvider>;
}
