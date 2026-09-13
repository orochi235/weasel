import { SceneCanvas, asNodeId, solid, useScene } from '@weasel-js/core';
import type {
  FillStyle, StyledRun, TextStyle, TextVerticalAlign,
} from '@weasel-js/core';

const W = 480;
const H = 300;

interface NodeData {
  text?: string;
  runs?: StyledRun[];
  style?: TextStyle;
  fill?: FillStyle;
  verticalAlign?: TextVerticalAlign;
  shape?: 'rect';
}

const INK = solid('#1c1c1c');

const leaf = (id: string, pose: { x: number; y: number; width: number; height: number; rotation?: number }, data: NodeData) => ({
  kind: 'leaf' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose,
  data,
});

/** No layer and no `drawOne`: every node here is painted by whichever built-in
 *  painter matches it, and anything carrying `data.text` matches `kit:text`. */
const NODES = [
  leaf('large', { x: 20, y: 16, width: 440, height: 32 }, {
    text: 'Painted by kit:text at 24px.',
    fill: INK,
    style: { fontSize: 24 },
  }),
  leaf('bold', { x: 20, y: 58, width: 440, height: 22 }, {
    text: '16px at weight 600.',
    fill: solid('#3a4a8a'),
    style: { fontSize: 16, fontWeight: 600 },
  }),
  leaf('italic', { x: 20, y: 86, width: 440, height: 22 }, {
    text: '14px italic.',
    fill: solid('#6a6a6a'),
    style: { fontSize: 14, fontStyle: 'italic' },
  }),
  leaf('runs', { x: 20, y: 120, width: 440, height: 26 }, {
    text: 'Runs: bold, italic, and a red word.',
    runs: [
      { text: 'Runs: ' },
      { text: 'bold', bold: true },
      { text: ', ' },
      { text: 'italic', italic: true },
      { text: ', and a ' },
      { text: 'red', fill: solid('#c0392b') },
      { text: ' word.' },
    ],
    fill: INK,
    style: { fontSize: 18 },
  }),
  // The rect shows the box `verticalAlign` resolves within.
  leaf('box', { x: 20, y: 160, width: 200, height: 120 }, {
    shape: 'rect',
    fill: solid('#e8eef8'),
  }),
  leaf('bottom', { x: 20, y: 160, width: 200, height: 120 }, {
    text: 'Bottom of\na tall box.',
    fill: INK,
    style: { fontSize: 18 },
    verticalAlign: 'bottom',
  }),
  leaf('rotated', { x: 250, y: 200, width: 210, height: 34, rotation: -Math.PI / 12 }, {
    text: 'Rotated by pose.',
    fill: solid('#7a1f5a'),
    style: { fontSize: 22, fontWeight: 600 },
  }),
];

export function TextNodesDemo() {
  const scene = useScene<NodeData, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });

  return (
    <div className="ckd-stack">
      <div className="ckd-canvas-frame">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          selectionMode="none"
        />
      </div>
    </div>
  );
}
