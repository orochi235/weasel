import { useRef, useState } from 'react';
import {
  SceneCanvas,
  createTextLayer,
  useScene,
  useSceneTextEdit,
  type CanvasHelpers,
  type RenderLayer, editPreset, movePreset, pickPreset, resizePreset, viewPreset,
} from '@weasel-js/core';
import { gridSnapSource } from '@weasel-js/guides';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { INITIAL_TEXT_NODES, type TextNode, type Pose } from './textDemoScene';
import { DemoStage } from './DemoStage';

const W = 600, H = 360;
const CELL = 10;
const SNAP = { sources: [gridSnapSource({ spacing: CELL })] };

export function TextDemo() {
  const scene = useScene({ items: INITIAL_TEXT_NODES });

  const liveNodes = (): TextNode[] =>
    [...scene.renderOrder()].map((id) => {
      const n = scene.get(id)!;
      const p = n.pose as Pose;
      return { ...n.data, x: p.x, y: p.y, width: p.width, height: p.height };
    });

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  // Overlay-aware poses, so the custom layers follow a drag or resize while it is under way.
  const helpersRef = useRef<CanvasHelpers<TextNode> | null>(null);

  const edit = useSceneTextEdit(scene, container);

  const resolvePose = (n: TextNode): Pose => {
    const overlayPose = helpersRef.current?.getEffectivePose(n.id);
    return overlayPose ?? { x: n.x, y: n.y, width: n.width, height: n.height };
  };

  // Hides the node under edit: the contenteditable overlay draws it meanwhile.
  const textLayer: RenderLayer<unknown> = createTextLayer<TextNode>({
    getTexts: liveNodes,
    getPose: (n) => {
      const p = resolvePose(n);
      return {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        text: n.text,
        runs: n.runs,
        style: n.style,
        fill: n.fill,
        stroke: n.stroke,
      };
    },
    isHidden: (n) => edit.isEditing(n.id),
    clipToBounds: true,
  });

  // So an empty text box stays visible.
  const outlineLayer: RenderLayer<unknown> = {
    id: 'text-bounds',
    label: 'Text bounds',
    draw: () => {
      const cmds: DrawCommand[] = [];
      for (const n of liveNodes()) {
        const p = resolvePose(n);
        cmds.push({
          kind: 'path',
          path: { kind: 'rect', x: p.x + 0.5, y: p.y + 0.5, width: p.width, height: p.height },
          stroke: { paint: { color: '#e8e8e8' }, width: 1 },
        });
      }
      return cmds;
    },
  };

  return (
    <div ref={setContainer} className="ckd-canvas-frame">
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={[viewPreset, pickPreset, movePreset, resizePreset, editPreset]}
          className="ckd-canvas"
          backgroundFill={{ color: '#fafafa' }}
          scene={scene}
          helpersRef={helpersRef}
          snap={SNAP}
          layers={{
            scene: null,
            'text-bounds': { layer: outlineLayer, before: 'selectionOverlay' },
            'text': { layer: textLayer, before: 'selectionOverlay' },
          }}
        />
      </DemoStage>
    </div>
  );
}
