import { useCallback, useRef } from 'react';
import {
  SceneCanvas,
  asNodeId,
  createTextLayer,
  gridSnapStrategy,
  caretIndexAt,
  pointInTextPose,
  useScene,
  useTextEdit,
  type CanvasHelpers,
  type RenderLayer,
  type TextStyle,
} from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';
import { clientToCanvas } from '../canvasCoords';
import { useBackend } from '../BackendContext';

interface TextNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  style?: TextStyle;
}
interface Pose {
  x: number;
  y: number;
  width: number;
  height: number;
}

const W = 600, H = 360;
const CELL = 10;
const HANDLE = 8;

const INITIAL: TextNode[] = [
  {
    id: 't1',
    x: 30,
    y: 30,
    width: 240,
    height: 80,
    text: 'Click to select. Double-click to edit.\nDrag a selected node to move it.',
    style: { fontSize: 16, fill: { fill: 'solid', color: '#1c1c1c' } },
  },
  {
    id: 't2',
    x: 320,
    y: 60,
    width: 240,
    height: 60,
    text: 'Center-aligned.',
    style: { fontSize: 20, align: 'center', fill: { fill: 'solid', color: '#3a4a8a' }, fontWeight: 600 },
  },
  {
    id: 't3',
    x: 60,
    y: 200,
    width: 480,
    height: 40,
    text: 'Enter commits, Shift+Enter newline, Escape cancels.',
    style: { fontSize: 14, fontStyle: 'italic', fill: { fill: 'solid', color: '#6a6a6a' } },
  },
  {
    id: 't4',
    x: 60,
    y: 250,
    width: 480,
    height: 50,
    text: 'Themed editing — magenta caret, yellow ::selection.',
    style: {
      fontSize: 16,
      fontWeight: 600,
      fill: { color: '#7a1f5a' },
      caretColor: '#ff00ff',
      selectionBackground: '#ffeb3b',
      selectionColor: '#000',
    },
  },
];

export function TextDemo() {
  const backend = useBackend();
  const scene = useScene({ items: INITIAL });

  // Live snapshot of every node's data + current pose, in render order. Used
  // by the custom text/outline layers and the dblclick caret resolver.
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
  const helpersRef = useRef<CanvasHelpers<Pose> | null>(null);

  const setText = useCallback(
    (id: string, text: string) => {
      const nid = asNodeId(id);
      const n = scene.get(nid);
      if (!n) return;
      scene.update(nid, { data: { ...n.data, text } });
    },
    [scene],
  );

  const edit = useTextEdit({
    container: containerRef.current,
    getText: (id) => scene.get(asNodeId(id))?.data.text ?? '',
    getStyle: (id) => scene.get(asNodeId(id))?.data.style,
    getScreenPose: (id) => {
      const n = scene.get(asNodeId(id));
      if (!n) return null;
      const p = n.pose as Pose;
      return {
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        fontSize: n.data.style?.fontSize ?? 16,
      };
    },
    setText,
  });

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
        style: n.style,
      };
    },
    isHidden: (n) => edit.isEditing(n.id),
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

  // Suppress text-edit triggering on the same gesture that just selected a
  // node — only an actual dblclick on the selected node enters edit mode.
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = e.target instanceof HTMLCanvasElement ? e.target : null;
      if (!canvas) return;
      const [cx, cy] = clientToCanvas(canvas, e.clientX, e.clientY);
      const nodes = liveNodes();
      let target: TextNode | null = null;
      for (let i = nodes.length - 1; i >= 0; i--) {
        if (pointInTextPose(cx, cy, nodes[i])) { target = nodes[i]; break; }
      }
      if (!target) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) { edit.startEdit(target.id); return; }
      const caret = caretIndexAt(ctx, cx, cy, {
        x: target.x, y: target.y, width: target.width, height: target.height,
        text: target.text, style: target.style,
      });
      edit.startEdit(target.id, { caret });
    },
    // liveNodes reads through `scene` (stable) on every call.
    [edit],
  );

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: W, height: H }}
      onDoubleClick={onDoubleClick}
    >
      <SceneCanvas
backend={backend}
              width={W}
        height={H}
        className="ckd-canvas"
        background="#fafafa"
        scene={scene}
        helpersRef={helpersRef}
        selectTool={{
          snap: gridSnapStrategy<Pose>(CELL),
          handleHitRadius: HANDLE,
        }}
        layers={{
          // No default scene — the custom text layer paints everything.
          scene: null,
          'text-bounds': { layer: outlineLayer, before: 'selectionOverlay' },
          'text': { layer: textLayer, before: 'selectionOverlay' },
          selectionOverlay: { handles: { size: HANDLE } },
        }}
      />
    </div>
  );
}

export const TEXT_DEMO_SOURCE = `// --- Scene ---
interface TextNode { id; x; y; width; height; text; style?: TextStyle }

const scene = useScene({ items: INITIAL });

// Reads the live (post-resize) data + pose for every node.
const liveNodes = () => [...scene.renderOrder()].map((id) => {
  const n = scene.get(id)!;
  return { ...n.data, ...(n.pose as Pose) };
});

// --- Text edit interaction (contenteditable overlay) ---
const edit = useTextEdit({
  container: containerRef.current,
  getText: (id) => scene.get(asNodeId(id))?.data.text ?? '',
  getStyle: (id) => scene.get(asNodeId(id))?.data.style,
  getScreenPose: (id) => { /* read from node.pose */ },
  setText: (id, text) => {
    const n = scene.get(asNodeId(id));
    if (n) scene.update(asNodeId(id), { data: { ...n.data, text } });
  },
});

// SceneCanvas owns useMove + useResize + useSelection; \`snap\` plugs the
// grid behavior in. Custom text layer reads overlay-aware poses via helpersRef.
return (
  <div ref={containerRef} onDoubleClick={onDoubleClick}>
    <SceneCanvas
      width={W} height={H}
      scene={scene}
      helpersRef={helpersRef}
      selectTool={{ snap: gridSnapStrategy<Pose>(10) }}
      layers={{
        scene: null,
        'text': { layer: textLayer, before: 'selectionOverlay' },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  </div>
);
`;
