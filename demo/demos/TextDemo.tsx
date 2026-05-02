import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSelectionOverlayLayer,
  createSetTextOp,
  createTextLayer,
  gridSnapStrategy,
  pointInTextPose,
  runLayers,
  snap,
  useMoveInteraction,
  useTextEditInteraction,
  type MoveAdapter,
  type Op,
  type RenderLayer,
  type TextStyle,
} from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';
import { setupCanvasDpr } from '@orochi235/weasel';

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

const W = 600, H = 320;
const CELL = 10;

const INITIAL: TextNode[] = [
  {
    id: 't1',
    x: 30,
    y: 30,
    width: 240,
    height: 80,
    text: 'Click to select. Double-click to edit.\nDrag a selected node to move it.',
    style: { fontSize: 16, fill: { kind: 'solid', color: '#1c1c1c' } },
  },
  {
    id: 't2',
    x: 320,
    y: 60,
    width: 240,
    height: 60,
    text: 'Center-aligned.',
    style: { fontSize: 20, align: 'center', fill: { kind: 'solid', color: '#3a4a8a' }, fontWeight: 600 },
  },
  {
    id: 't3',
    x: 60,
    y: 200,
    width: 480,
    height: 40,
    text: 'Enter commits, Shift+Enter newline, Escape cancels.',
    style: { fontSize: 14, fontStyle: 'italic', fill: { kind: 'solid', color: '#6a6a6a' } },
  },
];

export function TextDemo() {
  const [nodes, setNodes] = useState<TextNode[]>(INITIAL);
  const [selection, setSelection] = useState<string[]>([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const setText = useCallback((id: string, text: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, text } : n)));
  }, []);

  const moveAdapter: MoveAdapter<TextNode, Pose> = {
    getObject: (id) => nodesRef.current.find((n) => n.id === id),
    getPose: (id) => {
      const n = nodesRef.current.find((x) => x.id === id)!;
      return { x: n.x, y: n.y, width: n.width, height: n.height };
    },
    getParent: () => null,
    setPose: (id, pose) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...pose } : n)));
    },
    setParent: () => {},
    applyBatch: (ops: Op[]) => {
      const adapter = { ...moveAdapter, setText };
      for (const op of ops) op.apply(adapter);
    },
  };

  const move = useMoveInteraction<TextNode, Pose>(moveAdapter, {
    translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
    behaviors: [snap(gridSnapStrategy<Pose>(CELL))],
  });

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
      moveAdapter.applyBatch(
        [createSetTextOp({ id, from: prev, to: text, label: 'Edit text' })],
        'Edit text',
      );
    },
  });

  const draggingId = useRef<string | null>(null);

  const hit = (wx: number, wy: number): TextNode | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      if (pointInTextPose(wx, wy, nodesRef.current[i])) return nodesRef.current[i];
    }
    return null;
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (edit.editingId) return;
      const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
      const target = hit(cx, cy);
      if (!target) {
        setSelection([]);
        return;
      }
      setSelection([target.id]);
      draggingId.current = target.id;
      e.currentTarget.setPointerCapture(e.pointerId);
      move.start({
        ids: [target.id],
        worldX: cx,
        worldY: cy,
        clientX: e.clientX,
        clientY: e.clientY,
      });
    },
    [move, edit],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!draggingId.current) return;
      const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
      move.move({
        worldX: cx,
        worldY: cy,
        clientX: e.clientX,
        clientY: e.clientY,
        modifiers: { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey },
      });
    },
    [move],
  );

  const onPointerUp = useCallback(() => {
    if (!draggingId.current) return;
    draggingId.current = null;
    move.end();
  }, [move]);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
      const target = hit(cx, cy);
      if (target) edit.startEdit(target.id);
    },
    [edit],
  );

  const overlay = move.overlay;
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    setupCanvasDpr(c, ctx, W, H);
    ctx.clearRect(0, 0, W, H);

    const bgLayer: RenderLayer<unknown> = {
      id: 'bg',
      label: 'Background',
      draw: (cx) => {
        cx.fillStyle = '#fafafa';
        cx.fillRect(0, 0, W, H);
        cx.strokeStyle = '#e8e8e8';
        cx.lineWidth = 1;
        for (const n of nodesRef.current) {
          const hide = overlay?.hideIds?.includes(n.id);
          if (hide) continue;
          cx.strokeRect(n.x + 0.5, n.y + 0.5, n.width, n.height);
        }
      },
    };

    const textLayer = createTextLayer<TextNode>({
      getTexts: () => nodesRef.current,
      getPose: (n) => {
        const ghost = overlay?.poses?.get(n.id);
        return {
          x: ghost?.x ?? n.x,
          y: ghost?.y ?? n.y,
          width: n.width,
          height: n.height,
          text: n.text,
          style: n.style,
        };
      },
      isHidden: (n) => edit.isEditing(n.id),
    });

    const selectionLayer = createSelectionOverlayLayer<Pose>({
      getSelection: () => selectionRef.current,
      getPose: (id) => {
        const n = nodesRef.current.find((x) => x.id === id);
        if (!n) return null;
        const ghost = overlay?.poses?.get(id);
        return {
          x: ghost?.x ?? n.x,
          y: ghost?.y ?? n.y,
          width: n.width,
          height: n.height,
        };
      },
      handles: false,
    });

    runLayers(ctx, [bgLayer, textLayer, selectionLayer], undefined, {});
  }, [nodes, selection, overlay, edit]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: W, height: H }}>
      <canvas
        ref={canvasRef}
        className="ckd-canvas"
        width={W}
        height={H}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
      />
    </div>
  );
}

export const TEXT_DEMO_SOURCE = `// --- Scene ---
interface TextNode { id; x; y; width; height; text; style?: TextStyle }
const [nodes, setNodes] = useState<TextNode[]>(INITIAL);
const [selection, setSelection] = useState<string[]>([]);

// --- Move interaction (drag a selected node) ---
const move = useMoveInteraction<TextNode, Pose>(moveAdapter, {
  translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  behaviors: [snap(gridSnapStrategy<Pose>(10))],
});

// --- Edit interaction (contenteditable overlay) ---
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

// --- Pointer routing: click selects + starts drag, double-click edits ---
onPointerDown: hit-test → setSelection([id]) → move.start(...)
onPointerMove: move.move(...)
onPointerUp:   move.end()
onDoubleClick: hit-test → edit.startEdit(id)

// --- Render: text + selection outline (the move overlay supplies live ghost poses) ---
const textLayer = createTextLayer<TextNode>({
  getTexts: () => nodesRef.current,
  getPose: (n) => ({
    x: overlay?.poses?.get(n.id)?.x ?? n.x,
    y: overlay?.poses?.get(n.id)?.y ?? n.y,
    width: n.width, height: n.height, text: n.text, style: n.style,
  }),
  isHidden: (n) => edit.isEditing(n.id),
});
const selectionLayer = createSelectionOverlayLayer({
  getSelection: () => selectionRef.current,
  getPose: (id) => /* same ghost-aware pose lookup */ ...,
  handles: false,
});
runLayers(ctx, [bgLayer, textLayer, selectionLayer], undefined, {});
`;
