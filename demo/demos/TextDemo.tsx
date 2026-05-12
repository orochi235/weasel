import { useRef } from 'react';
import {
  SceneCanvas,
  createTextLayer,
  gridSnapStrategy,
  useScene,
  useSceneTextEdit,
  type CanvasHelpers,
  type RenderLayer,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import { INITIAL_TEXT_NODES, type TextNode, type Pose } from './textDemoScene';

const W = 600, H = 360;
const CELL = 10;

export function TextDemo() {
  const scene = useScene({ items: INITIAL_TEXT_NODES });

  // Live snapshot of every node's data + current pose, in render order. Used
  // by the custom text/outline layers.
  const liveNodes = (): TextNode[] =>
    [...scene.renderOrder()].map((id) => {
      const n = scene.get(id)!;
      const p = n.pose as Pose;
      return { ...n.data, x: p.x, y: p.y, width: p.width, height: p.height };
    });

  const containerRef = useRef<HTMLDivElement | null>(null);
  // helpersRef gives custom layers overlay-aware pose lookups so the text
  // and selection ghost follow live drag/resize without us re-implementing
  // the overlay fold-in.
  const helpersRef = useRef<CanvasHelpers<TextNode> | null>(null);

  // Scene-aware text edit + double-click-to-edit binding. Wires getText /
  // getStyle / getScreenPose / setText / getRuns / setRuns + the dblclick
  // caret-resolver against `scene` automatically.
  const edit = useSceneTextEdit(scene, containerRef.current);

  const resolvePose = (n: TextNode): Pose => {
    const overlayPose = helpersRef.current?.getEffectivePose(n.id);
    return overlayPose ?? { x: n.x, y: n.y, width: n.width, height: n.height };
  };

  // Custom text layer — replaces the default scene drawer so we can render
  // text via createTextLayer and hide the node currently being edited (the
  // contenteditable overlay handles its own visuals).
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
      };
    },
    isHidden: (n) => edit.isEditing(n.id),
    // Glyphs that overflow the declared bounds are clipped — matching the
    // visible-box affordance the dashed outline implies.
    clipToBounds: true,
  });

  // Faint background outline per node so empty text boxes stay visible.
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
    <div
      ref={containerRef}
      style={{ position: 'relative', width: W, height: H }}
      onDoubleClick={edit.onDoubleClick}
    >
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        background="#fafafa"
        scene={scene}
        helpersRef={helpersRef}
        selectTool={{
          snap: gridSnapStrategy<TextNode>(CELL),
        }}
        layers={{
          // No default scene — the custom text layer paints everything.
          scene: null,
          'text-bounds': { layer: outlineLayer, before: 'selectionOverlay' },
          'text': { layer: textLayer, before: 'selectionOverlay' },
        }}
      />
    </div>
  );
}
