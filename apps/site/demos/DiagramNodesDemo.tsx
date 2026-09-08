import { useEffect, useMemo } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  effectivePose,
  useScene,
  type AddNodeSpec,
  type DrawCommand,
  type RenderLayer,
} from '@weasel-js/core';
import {
  bodyTrait,
  layoutBody,
  measureBody,
  portsOf,
  registerDiagramShape,
  sizeToBody,
  type BodySpec,
  type DiagramNode,
} from '@weasel-js/diagram';

const W = 640, H = 360;
const INK = '#7ba7c7';
const PORT = '#e0913f';

interface Data {
  diagram?: DiagramNode;
  fill?: { color: string };
  stroke?: { paint: { color: string }; width: number };
  text?: string;
  style?: { fontFamily: string; fontSize: number };
}
interface Pose { x: number; y: number; width: number; height: number }

/** One participant: the outline and rows it is built from, and where it sits. */
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
    return specs;
  }, []);

  const scene = useScene<Data, 'main', Pose>({ systemLayers: [{ id: 'main' }], initial });

  // Ports are painted here and hit-tested nowhere: making them grabbable is
  // the connect gesture's job, and it lands with edges in the next arc.
  const ports: RenderLayer<unknown> = useMemo(() => ({
    id: 'diagram-ports',
    label: 'Ports',
    draw: (): DrawCommand[] => {
      const cmds: DrawCommand[] = [];
      for (const node of scene.renderOrderNodes()) {
        // The pose the node is *painted* at, so a port keeps up with a drag.
        for (const p of portsOf(node, effectivePose(scene, node))) {
          cmds.push({
            kind: 'path',
            path: { kind: 'rect', x: p.point.x - 3.5, y: p.point.y - 3.5, width: 7, height: 7 },
            fill: { color: PORT },
          });
        }
      }
      return cmds;
    },
  }), [scene]);

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      layers={{ ports: { layer: ports, after: 'scene' } }}
    />
  );
}

export function DiagramNodesDemo() {
  return <WeaselProvider><DiagramNodesInner /></WeaselProvider>;
}
