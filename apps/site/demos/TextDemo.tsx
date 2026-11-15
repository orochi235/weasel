import { useState } from 'react';
import {
  SceneCanvas, asNodeId, solid, useScene, useSceneTextEdit,
  editPreset, movePreset, pickPreset, resizePreset, viewPreset,
} from '@weasel-js/core';
import type { Fill, RectPose } from '@weasel-js/core';
import { gridSnapSource } from '@weasel-js/guides';
import type { StyledRun, TextStyle, TextVerticalAlign } from '@weasel-js/text';
import { CharacterOptions, isCharacterChrome } from '@weasel-js/ui/components/inspector/CharacterOptions';
import { DemoStage } from './DemoStage';

const W = 600;
const H = 400;
const SNAP = { sources: [gridSnapSource({ spacing: 10 })] };

interface NodeData {
  text: string;
  runs?: StyledRun[];
  style?: TextStyle;
  fill?: Fill;
  background?: Fill;
  verticalAlign?: TextVerticalAlign;
}

const INK = { paint: solid('#1c1c1c') };
const BOX_FILL = { paint: solid('#e8eef8') };

const text = (id: string, pose: RectPose, data: NodeData) => ({
  kind: 'mark' as const,
  layer: 'default' as const,
  id: asNodeId(id),
  pose,
  data,
});

// The visual specs under tests/visual measure these nodes by position: t1, t4, and t6
// keep their boxes, and the rest are named in text-painter.spec.ts.
const NODES = [
  text('t1', { x: 30, y: 30, width: 240, height: 80 }, {
    text: 'Click to select. Double-click to edit.\nDrag a selected node to move it.',
    fill: INK,
    style: { fontSize: 16, wrap: true },
  }),
  text('large', { x: 300, y: 16, width: 270, height: 32 }, {
    text: '24px at weight 600.',
    fill: { paint: solid('#3a4a8a') },
    style: { fontSize: 24, fontWeight: 600 },
  }),
  text('italic', { x: 300, y: 54, width: 270, height: 22 }, {
    text: '14px italic.',
    fill: { paint: solid('#6a6a6a') },
    style: { fontSize: 14, fontStyle: 'italic' },
  }),
  text('center', { x: 300, y: 84, width: 270, height: 30 }, {
    text: 'Centered in its box.',
    fill: INK,
    background: BOX_FILL,
    style: { fontSize: 18, align: 'center', wrap: true },
  }),
  text('t6', { x: 30, y: 130, width: 540, height: 60 }, {
    text: 'Underline, strikethrough, and tracking.',
    runs: [
      { text: 'Underline', underline: true },
      { text: ', ' },
      { text: 'strikethrough', strikethrough: true },
      { text: ', and ' },
      { text: 'tracking', letterSpacing: 3 },
      { text: '.' },
    ],
    fill: INK,
    style: { fontSize: 16, wrap: true },
  }),
  text('right', { x: 30, y: 200, width: 540, height: 36 }, {
    text: 'Right-aligned, with a red word.',
    runs: [
      { text: 'Right-aligned, with a ' },
      { text: 'red', bold: true, fill: { paint: solid('#c0392b') } },
      { text: ' word.' },
    ],
    fill: { paint: solid('#2f6f4f') },
    background: BOX_FILL,
    style: { fontSize: 20, align: 'right', wrap: true },
  }),
  text('t4', { x: 60, y: 250, width: 480, height: 50 }, {
    text: 'Themed editing — magenta caret, yellow ::selection.',
    fill: { paint: solid('#7a1f5a') },
    style: {
      fontSize: 16,
      fontWeight: 600,
      wrap: true,
      caretColor: '#ff00ff',
      selectionBackground: '#ffeb3b',
      selectionColor: '#000',
    },
  }),
  // No `wrap`: a line typed past the box stays one line, on the canvas and in the editor.
  text('bottom', { x: 30, y: 300, width: 200, height: 90 }, {
    text: 'Bottom of\na tall box.',
    fill: INK,
    background: BOX_FILL,
    style: { fontSize: 16 },
    verticalAlign: 'bottom',
  }),
  text('rotated', { x: 300, y: 330, width: 230, height: 34, rotation: -Math.PI / 12 }, {
    text: 'Rotated by pose.',
    fill: { paint: solid('#7a1f5a') },
    style: { fontSize: 22, fontWeight: 600 },
  }),
];

export function TextDemo() {
  const scene = useScene<NodeData, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: NODES,
  });
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const edit = useSceneTextEdit(scene, frame, { isEditorChrome: isCharacterChrome });

  return (
    <div className="ckd-demo">
      <div className="ckd-strip-slot">
        <CharacterOptions className="ckd-strip" style={edit.effectiveStyle} onPatch={edit.applyStyleToSelection} />
      </div>
      <div className="ckd-canvas-frame" ref={setFrame}>
        <DemoStage width={W} height={H}>
          <SceneCanvas
            className="ckd-canvas"
            backgroundFill={{ color: '#ffffff' }}
            scene={scene}
            snap={SNAP}
            features={[viewPreset, pickPreset, movePreset, resizePreset, editPreset]}
          />
        </DemoStage>
      </div>
    </div>
  );
}
