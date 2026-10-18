import { useState } from 'react';
import { SceneCanvas, asNodeId, solid, useScene, useSceneTextEdit } from '@weasel-js/core';
import type { Fill } from '@weasel-js/core';
import type { StyledRun, TextStyle, TextVerticalAlign } from '@weasel-js/text';
import { CharacterOptions, isCharacterChrome } from '@weasel-js/ui';
import { DemoStage } from './DemoStage';

const W = 480;
const H = 380;

interface NodeData {
  text?: string;
  runs?: StyledRun[];
  style?: TextStyle;
  fill?: Fill;
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
    fill: { paint: INK },
    style: { fontSize: 24 },
  }),
  leaf('bold', { x: 20, y: 58, width: 440, height: 22 }, {
    text: '16px at weight 600.',
    fill: { paint: solid('#3a4a8a') },
    style: { fontSize: 16, fontWeight: 600 },
  }),
  leaf('italic', { x: 20, y: 86, width: 440, height: 22 }, {
    text: '14px italic.',
    fill: { paint: solid('#6a6a6a') },
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
      { text: 'red', fill: { paint: solid('#c0392b') } },
      { text: ' word.' },
    ],
    fill: { paint: INK },
    style: { fontSize: 18 },
  }),
  // The rect shows the box `verticalAlign` resolves within.
  leaf('box', { x: 20, y: 160, width: 200, height: 120 }, {
    shape: 'rect',
    fill: { paint: solid('#e8eef8') },
  }),
  leaf('bottom', { x: 20, y: 160, width: 200, height: 120 }, {
    text: 'Bottom of\na tall box.',
    fill: { paint: INK },
    style: { fontSize: 18 },
    verticalAlign: 'bottom',
  }),
  leaf('rotated', { x: 250, y: 200, width: 210, height: 34, rotation: -Math.PI / 12 }, {
    text: 'Rotated by pose.',
    fill: { paint: solid('#7a1f5a') },
    style: { fontSize: 22, fontWeight: 600 },
  }),
  // The rects show the width `align` resolves within.
  leaf('center-box', { x: 20, y: 296, width: 440, height: 30 }, {
    shape: 'rect',
    fill: { paint: solid('#e8eef8') },
  }),
  leaf('center', { x: 20, y: 296, width: 440, height: 30 }, {
    text: 'Centered in its box.',
    fill: { paint: INK },
    style: { fontSize: 20, align: 'center' },
  }),
  leaf('right-box', { x: 20, y: 336, width: 440, height: 30 }, {
    shape: 'rect',
    fill: { paint: solid('#e8eef8') },
  }),
  leaf('right', { x: 20, y: 336, width: 440, height: 30 }, {
    text: 'Right-aligned in its box.',
    fill: { paint: solid('#2f6f4f') },
    style: { fontSize: 20, align: 'right' },
  }),
];

export function TextNodesDemo() {
  const scene = useScene<NodeData, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const edit = useSceneTextEdit(scene, frame, { isEditorChrome: isCharacterChrome });

  return (
    <div className="ckd-stack">
      <CharacterOptions className="ckd-strip" style={edit.effectiveStyle} onPatch={edit.applyStyleToSelection} />
      <div className="ckd-canvas-frame" ref={setFrame} onDoubleClick={edit.onDoubleClick}>
        <DemoStage width={W} height={H}>
          <SceneCanvas
            className="ckd-canvas"
            backgroundFill={{ color: '#ffffff' }}
            scene={scene}
            selectable={false}
            // The overlay stands in for the node while it is edited.
            alphaFor={(id) => (id === edit.editingId ? 0 : 1)}
          />
        </DemoStage>
      </div>
    </div>
  );
}
