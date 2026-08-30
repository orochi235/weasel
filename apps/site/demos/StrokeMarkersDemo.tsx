import {
  asNodeId,
  pathFromD,
  SceneCanvas,
  useScene,
} from '@weasel-js/core';
import type { MarkerKey, Path, Stroke } from '@weasel-js/core';

const W = 540, H = 460;
const INK = { fill: 'solid' as const, color: '#1a130d' };
const ROW_W = 220, ROW_H = 22;

/** A shallow chevron, so `markerMid` has an interior authored vertex to sit
 *  on and `orient` has a corner to bisect. */
const CHEVRON: Path = pathFromD('M0 22 L110 0 L220 22');

const KEYS: MarkerKey[] = [
  'arrow', 'arrow-open', 'arrow-concave', 'diamond',
  'diamond-hollow', 'circle', 'square', 'bar',
];

interface RowData {
  path: Path;
  stroke: Stroke;
}
interface LabelData {
  text: string;
  style: { fontSize: number };
  fill: typeof INK;
}
type NodeData = RowData | LabelData;

const row = (id: string, y: number, stroke: Stroke) => ({
  kind: 'leaf' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose: { x: 40, y, width: ROW_W, height: ROW_H },
  data: { path: CHEVRON, stroke } satisfies RowData,
});

const label = (id: string, y: number, text: string) => ({
  kind: 'leaf' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose: { x: 40 + ROW_W + 20, y, width: 200, height: ROW_H },
  data: { text, style: { fontSize: 13 }, fill: INK } satisfies LabelData,
});

const NODES = KEYS.flatMap((key, i) => {
  const y = 30 + i * 40;
  return [
    row(`row-${key}`, y, { paint: INK, width: 3, markerEnd: key }),
    label(`label-${key}`, y, key),
  ];
}).concat([
  row('row-all-three', 30 + KEYS.length * 40, {
    paint: INK, width: 3,
    markerStart: 'circle', markerMid: 'diamond', markerEnd: 'arrow',
  }),
  label('label-all-three', 30 + KEYS.length * 40, 'start / mid / end'),
  // A thick translucent stroke, where the inset is plainly visible: without
  // it the ribbon would run under the head and out through the tip.
  row('row-inset-proof', 70 + KEYS.length * 40, {
    paint: { fill: 'solid', color: '#b3452e', opacity: 0.55 },
    width: 12, markerEnd: 'arrow',
  }),
  label('label-inset-proof', 70 + KEYS.length * 40, 'inset, thick stroke'),
]);

export function StrokeMarkersDemo() {
  const scene = useScene<NodeData, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selectionMode="none"
    />
  );
}
