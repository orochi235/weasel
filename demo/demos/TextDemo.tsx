import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTextLayer,
  pointInTextPose,
  runLayers,
  useTextEditInteraction,
  createSetTextOp,
  type RenderLayer,
  type TextStyle,
  type Op,
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

const W = 600, H = 320;

const INITIAL: TextNode[] = [
  {
    id: 't1',
    x: 30,
    y: 30,
    width: 240,
    height: 80,
    text: 'Double-click to edit me.\nThis line wraps when it gets long enough.',
    style: { fontSize: 16, color: '#1c1c1c' },
  },
  {
    id: 't2',
    x: 320,
    y: 60,
    width: 240,
    height: 60,
    text: 'Center-aligned text node.',
    style: { fontSize: 20, align: 'center', color: '#3a4a8a', fontWeight: 600 },
  },
  {
    id: 't3',
    x: 60,
    y: 200,
    width: 480,
    height: 40,
    text: 'Press Enter to commit, Shift+Enter for newline, Escape to cancel.',
    style: { fontSize: 14, fontStyle: 'italic', color: '#6a6a6a' },
  },
];

export function TextDemo() {
  const [nodes, setNodes] = useState<TextNode[]>(INITIAL);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setText = useCallback((id: string, text: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, text } : n)));
  }, []);

  const applyBatch = (ops: Op[]) => {
    const adapter = { setText };
    for (const op of ops) op.apply(adapter);
  };

  const edit = useTextEditInteraction({
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
      applyBatch([createSetTextOp({ id, from: prev, to: text, label: 'Edit text' })]);
    },
  });

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
      for (let i = nodesRef.current.length - 1; i >= 0; i--) {
        const n = nodesRef.current[i];
        if (pointInTextPose(cx, cy, n)) {
          edit.startEdit(n.id);
          return;
        }
      }
    },
    [edit],
  );

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    const bgLayer: RenderLayer<unknown> = {
      id: 'bg',
      label: 'Background',
      draw: (cx) => {
        cx.fillStyle = '#fafafa';
        cx.fillRect(0, 0, W, H);
        cx.strokeStyle = '#e0e0e0';
        cx.lineWidth = 1;
        for (const n of nodesRef.current) {
          cx.strokeRect(n.x + 0.5, n.y + 0.5, n.width, n.height);
        }
      },
    };

    const textLayer = createTextLayer<TextNode>({
      getTexts: () => nodesRef.current,
      getPose: (n) => ({
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        text: n.text,
        style: n.style,
      }),
      isHidden: (n) => edit.isEditing(n.id),
    });

    runLayers(ctx, [bgLayer, textLayer], undefined, {});
  }, [nodes, edit]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: W, height: H }}>
      <canvas
        ref={canvasRef}
        className="ckd-canvas"
        width={W}
        height={H}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}

export const TEXT_DEMO_SOURCE = `// --- Scene ---
interface TextNode {
  id: string; x: number; y: number; width: number; height: number;
  text: string; style?: TextStyle;
}
const [nodes, setNodes] = useState<TextNode[]>(INITIAL);

// --- Edit interaction ---
const edit = useTextEditInteraction({
  container: containerRef.current,
  getText: (id) => find(id)?.text ?? '',
  getStyle: (id) => find(id)?.style,
  getScreenPose: (id) => {
    const n = find(id);
    return n ? { x: n.x, y: n.y, width: n.width, height: n.height,
                 fontSize: n.style?.fontSize ?? 16 } : null;
  },
  setText: (id, text) => {
    const prev = find(id)?.text ?? '';
    if (prev === text) return;
    applyBatch([createSetTextOp({ id, from: prev, to: text, label: 'Edit text' })]);
  },
});

// --- Render ---
const textLayer = createTextLayer<TextNode>({
  getTexts: () => nodesRef.current,
  getPose: (n) => ({ x: n.x, y: n.y, width: n.width, height: n.height,
                     text: n.text, style: n.style }),
  isHidden: (n) => edit.isEditing(n.id), // suppress while overlay is up
});
runLayers(ctx, [bgLayer, textLayer], undefined, {});

// Double-click to enter edit:
onDoubleClick = (e) => {
  const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
  const hit = nodesRef.current.find((n) => pointInTextPose(cx, cy, n));
  if (hit) edit.startEdit(hit.id);
};
`;
