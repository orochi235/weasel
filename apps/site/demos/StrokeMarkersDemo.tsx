import {
  asNodeId,
  pathFromD,
  SceneCanvas,
  useScene,
} from '@weasel-js/core';
import type { MarkerKey, Path, Stroke } from '@weasel-js/core';
import { DemoStage } from './DemoStage';

const ROW_W = 150, ROW_H = 22, LABEL_W = 130, GAP = 36;
const COL_W = ROW_W + 20 + LABEL_W + 20;
const W = 40 + COL_W * 2, H = 340;
const INK = { kind: 'solid' as const, color: '#1a130d' };

/** A shallow chevron, so `markerMid` has an interior authored vertex to sit
 *  on and `orient` has a corner to bisect. */
const CHEVRON: Path = pathFromD('M0 22 L75 0 L150 22');

const KEYS: MarkerKey[] = [
  'arrow', 'arrow-open', 'arrow-concave', 'triangle-hollow', 'diamond', 'diamond-hollow', 'circle',
  'square', 'bar', 'crow-one', 'crow-many', 'crow-zero-one', 'crow-one-many', 'crow-zero-many',
];
const PER_COL = Math.ceil(KEYS.length / 2);

interface RowData {
  path: Path;
  stroke: Stroke;
}
interface LabelData {
  text: string;
  style: { fontSize: number };
  fill: { paint: typeof INK };
}
type NodeData = RowData | LabelData;

const row = (id: string, x: number, y: number, stroke: Stroke) => ({
  kind: 'mark' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose: { x, y, width: ROW_W, height: ROW_H },
  data: { path: CHEVRON, stroke } satisfies RowData,
});

const label = (id: string, x: number, y: number, text: string) => ({
  kind: 'mark' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose: { x: x + ROW_W + 20, y, width: LABEL_W, height: ROW_H },
  data: { text, style: { fontSize: 13 }, fill: { paint: INK } } satisfies LabelData,
});

const BELOW = 30 + PER_COL * GAP;

const NODES = KEYS.flatMap((key, i) => {
  const x = 40 + Math.floor(i / PER_COL) * COL_W;
  const y = 30 + (i % PER_COL) * GAP;
  return [
    row(`row-${key}`, x, y, { paint: INK, width: 3, markerEnd: key }),
    label(`label-${key}`, x, y, key),
  ];
}).concat([
  row('row-all-three', 40, BELOW, {
    paint: INK, width: 3,
    markerStart: 'circle', markerMid: 'diamond', markerEnd: 'arrow',
  }),
  label('label-all-three', 40, BELOW, 'start / mid / end'),
  // A thick translucent stroke, where the inset is plainly visible: without
  // it the ribbon would run under the head and out through the tip.
  row('row-inset-proof', 40 + COL_W, BELOW, {
    paint: { kind: 'solid', color: '#b3452e', opacity: 0.55 },
    width: 12, markerEnd: 'arrow',
  }),
  label('label-inset-proof', 40 + COL_W, BELOW, 'inset, thick stroke'),
]);

export function StrokeMarkersDemo() {
  const scene = useScene<NodeData, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        className="ckd-canvas"
        scene={scene}
        selectable={false}
      />
    </DemoStage>
  );
}
