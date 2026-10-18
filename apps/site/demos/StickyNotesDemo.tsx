import { useState } from 'react';
import {
  SceneCanvas,
  asNodeId,
  defaultPaintBounds,
  solid,
  stickyData,
  useDepSource,
  useLatest,
  useScene,
  useSceneTextEdit,
  useSelection,
  type ToolsApi,
  type UseSceneTextEditReturn,
} from '@weasel-js/core';
import { ToolPalette } from '@weasel-js/ui';

const W = 520, H = 340;

const note = (id: string, x: number, y: number, text: string, color?: string) => ({
  id: asNodeId(id),
  kind: 'leaf' as const,
  layer: 'default' as const,
  parent: null,
  pose: { x, y, width: 150, height: 150 },
  // The tool's own node: a text node with a background.
  data: stickyData({ text, ...(color ? { background: { paint: solid(color) } } : {}) }),
});

const INITIAL = [
  note('a', 30, 30, 'Drag to draw a note, or click to place one'),
  note('b', 200, 60, 'Double-click to edit', '#c8ecffff'),
  note('c', 355, 175, 'A note cuts its text at its edge, so this sentence, which runs on well past the bottom of the paper, is clipped there.', '#ffd6e0ff'),
];

/** Publishes the canvas's text editor as the `textEdit` dep, so a new note
 *  opens with its caret and a click on a selected one edits it. A child of
 *  `<SceneCanvas>`, so its registration lands after the canvas's stub. */
function TextEditDep({ edit }: { edit: UseSceneTextEditReturn }): null {
  const ref = useLatest(edit);
  useDepSource('textEdit', () => ({
    startEdit: (id, opts) => ref.current.startEdit(id, opts),
    isTextNode: (id) => ref.current.isTextNode(id),
  }));
  return null;
}

export function StickyNotesDemo() {
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const selection = useSelection({ mode: 'multi' });
  const [tools, setTools] = useState<ToolsApi | null>(null);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const edit = useSceneTextEdit(scene, frame);
  return (
    <div className="ckd-shape-tools-demo">
      {tools && <ToolPalette tools={tools} orientation="horizontal" />}
      <div className="ckd-canvas-frame" ref={setFrame} onDoubleClick={edit.onDoubleClick}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          backgroundFill={{ color: '#f4f1ea' }}
          scene={scene}
          selection={selection}
          features={['pick', 'move', 'resize', 'edit']}
          defaultTools={['sticky', 'pencil', 'text']}
          initialActiveTool="sticky"
          // The overlay stands in for the text it is editing; the note's paper stays.
          layers={{ scene: { drawOne: edit.drawOne, paintBounds: defaultPaintBounds } }}
          onToolsCreated={setTools}
        >
          <TextEditDep edit={edit} />
        </SceneCanvas>
      </div>
    </div>
  );
}
