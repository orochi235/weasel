import { useCallback, useRef, useState } from 'react';
import {
  Canvas,
  createSetTextOp,
  createTextLayer,
  gridSnapStrategy,
  caretIndexAt,
  pointInTextPose,
  snap,
  useTextEdit,
  type CanvasHelpers,
  type Op,
  type RenderLayer,
  type TextStyle,
} from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';

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
  const [nodes, setNodes] = useState<TextNode[]>(INITIAL);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const containerRef = useRef<HTMLDivElement | null>(null);
  // helpersRef gives custom layers overlay-aware pose lookups so the text
  // and selection ghost follow live drag/resize without us re-implementing
  // the overlay fold-in.
  const helpersRef = useRef<CanvasHelpers<Pose> | null>(null);

  const setText = useCallback((id: string, text: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, text } : n)));
  }, []);

  const edit = useTextEdit({
    container: containerRef.current,
    getText: (id) => nodesRef.current.find((n) => n.id === id)?.text ?? '',
    getStyle: (id) => nodesRef.current.find((n) => n.id === id)?.style,
    getScreenPose: (id) => {
      const n = nodesRef.current.find((x) => x.id === id);
      if (!n) return null;
      return {
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        fontSize: n.style?.fontSize ?? 16,
      };
    },
    setText: (id, text) => {
      const prev = nodesRef.current.find((n) => n.id === id)?.text ?? '';
      if (prev === text) return;
      const op: Op = createSetTextOp({ id, from: prev, to: text, label: 'Edit text' });
      op.apply({ setText });
    },
  });

  const resolvePose = (n: TextNode): Pose => {
    const overlayPose = helpersRef.current?.getEffectivePose(n.id);
    return overlayPose ?? { x: n.x, y: n.y, width: n.width, height: n.height };
  };

  // Custom text layer — replaces the default scene drawer so we can render
  // text via createTextLayer and hide the node currently being edited (the
  // contenteditable overlay handles its own visuals).
  const textLayer: RenderLayer<unknown> = createTextLayer<TextNode>({
    getTexts: () => nodesRef.current,
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
    draw: (cx) => {
      cx.strokeStyle = '#e8e8e8';
      cx.lineWidth = 1;
      for (const n of nodesRef.current) {
        const p = resolvePose(n);
        cx.strokeRect(p.x + 0.5, p.y + 0.5, p.width, p.height);
      }
    },
  };

  // Suppress text-edit triggering on the same gesture that just selected a
  // node — only an actual dblclick on the selected node enters edit mode.
  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const canvas = e.target instanceof HTMLCanvasElement ? e.target : null;
      if (!canvas) return;
      const [cx, cy] = clientToCanvas(canvas, e.clientX, e.clientY);
      let target: TextNode | null = null;
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        if (pointInTextPose(cx, cy, nodesRef.current[i])) { target = nodesRef.current[i]; break; }
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
    [edit],
  );

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: W, height: H }}
      onDoubleClick={onDoubleClick}
    >
      <Canvas
        width={W}
        height={H}
        className="ckd-canvas"
        background="#fafafa"
        items={nodes}
        setItems={setNodes}
        toPose={(n) => ({ x: n.x, y: n.y, width: n.width, height: n.height })}
        helpersRef={helpersRef}
        moveOptions={{ behaviors: [snap(gridSnapStrategy<Pose>(CELL))] }}
        handleHitRadius={HANDLE}
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
const [nodes, setNodes] = useState<TextNode[]>(INITIAL);

// --- Text edit interaction (contenteditable overlay) ---
const edit = useTextEdit({
  container: containerRef.current,
  getText: (id) => find(id)?.text ?? '',
  getStyle: (id) => find(id)?.style,
  getScreenPose: (id) => {
    const n = find(id);
    return n ? { x: n.x, y: n.y, width: n.width, height: n.height,
                 fontSize: n.style?.fontSize ?? 16 } : null;
  },
  setText: (id, text) => {
    const op = createSetTextOp({ id, from: prev, to: text, label: 'Edit text' });
    op.apply({ setText });
  },
});

// --- Custom text layer reads overlay-aware poses via Canvas helpersRef ---
const helpersRef = useRef<CanvasHelpers<Pose> | null>(null);
const textLayer = createTextLayer<TextNode>({
  getTexts: () => nodesRef.current,
  getPose: (n) => {
    const p = helpersRef.current?.getEffectivePose(n.id) ?? n;
    return { x: p.x, y: p.y, width: p.width, height: p.height, text: n.text, style: n.style };
  },
  isHidden: (n) => edit.isEditing(n.id),
});

// <Canvas> owns useMove + useResize + useSelection; we just plug a snap
// behavior into moveOptions and slot the text layer into the layer stack.
// Double-click on the wrapping div routes through caretIndexAt → edit.startEdit.
return (
  <div ref={containerRef} onDoubleClick={onDoubleClick}>
    <Canvas
      width={W} height={H}
      items={nodes} setItems={setNodes}
      toPose={(n) => ({ x: n.x, y: n.y, width: n.width, height: n.height })}
      helpersRef={helpersRef}
      moveOptions={{ behaviors: [snap(gridSnapStrategy<Pose>(10))] }}
      layers={{
        scene: null,
        'text': { layer: textLayer, before: 'selectionOverlay' },
        selectionOverlay: { handles: { size: HANDLE } },
      }}
    />
  </div>
);
`;
