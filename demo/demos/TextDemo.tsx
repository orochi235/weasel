import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createSelectionOverlayLayer,
  createSetTextOp,
  createTextLayer,
  gridSnapStrategy,
  caretIndexAt,
  pointInTextPose,
  runLayers,
  setupCanvasDpr,
  snap,
  useMove,
  useResize,
  useTextEdit,
  type MoveAdapter,
  type Op,
  type RenderLayer,
  type ResizeAdapter,
  type ResizeAnchor,
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

  const move = useMove<TextNode, Pose>(moveAdapter, {
    translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
    behaviors: [snap(gridSnapStrategy<Pose>(CELL))],
  });

  const resizeAdapter: ResizeAdapter<TextNode, Pose> = {
    getObject: (id) => nodesRef.current.find((n) => n.id === id),
    getPose: (id) => {
      const n = nodesRef.current.find((x) => x.id === id)!;
      return { x: n.x, y: n.y, width: n.width, height: n.height };
    },
    setPose: (id, pose) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...pose } : n)));
    },
    applyBatch: (ops: Op[]) => {
      for (const op of ops) op.apply(resizeAdapter);
    },
  };

  const resize = useResize<TextNode, Pose>(resizeAdapter, {});
  const activeResize = useRef<{ id: string; anchor: ResizeAnchor } | null>(null);

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

  /** Bottom-right corner of the currently selected node, if any. */
  const handleForSelection = (): { id: string; cx: number; cy: number; anchor: ResizeAnchor } | null => {
    const id = selectionRef.current[0];
    if (!id) return null;
    const n = nodesRef.current.find((x) => x.id === id);
    if (!n) return null;
    return {
      id,
      cx: n.x + n.width,
      cy: n.y + n.height,
      anchor: { x: 'min', y: 'min' },
    };
  };

  const hitHandle = (wx: number, wy: number) => {
    const h = handleForSelection();
    if (!h) return null;
    if (Math.abs(wx - h.cx) <= HANDLE && Math.abs(wy - h.cy) <= HANDLE) return h;
    return null;
  };

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (edit.editingId) return;
      const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);

      const handle = hitHandle(cx, cy);
      if (handle) {
        activeResize.current = { id: handle.id, anchor: handle.anchor };
        e.currentTarget.setPointerCapture(e.pointerId);
        resize.start(handle.id, handle.anchor, cx, cy);
        return;
      }

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
    [move, resize, edit],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
      if (activeResize.current) {
        resize.move(cx, cy, {
          alt: e.altKey,
          shift: e.shiftKey,
          meta: e.metaKey,
          ctrl: e.ctrlKey,
        });
        return;
      }
      if (!draggingId.current) return;
      move.move({
        worldX: cx,
        worldY: cy,
        clientX: e.clientX,
        clientY: e.clientY,
        modifiers: { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey },
      });
    },
    [move, resize],
  );

  const onPointerUp = useCallback(() => {
    if (activeResize.current) {
      activeResize.current = null;
      resize.end();
      return;
    }
    if (!draggingId.current) return;
    draggingId.current = null;
    move.end();
  }, [move, resize]);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const [cx, cy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
      const target = hit(cx, cy);
      if (!target) return;
      const ctx = e.currentTarget.getContext('2d');
      if (!ctx) {
        edit.startEdit(target.id);
        return;
      }
      const caret = caretIndexAt(ctx, cx, cy, {
        x: target.x, y: target.y, width: target.width, height: target.height,
        text: target.text, style: target.style,
      });
      edit.startEdit(target.id, { caret });
    },
    [edit],
  );

  const overlay = move.overlay;
  const resizeOverlay = resize.overlay;

  /** Resolve a node's effective pose: live resize > live move > committed. */
  const resolvePose = (n: TextNode): Pose => {
    if (resizeOverlay && activeResize.current?.id === n.id) {
      return resizeOverlay.currentPose;
    }
    const ghost = overlay?.poses?.get(n.id);
    return {
      x: ghost?.x ?? n.x,
      y: ghost?.y ?? n.y,
      width: ghost?.width ?? n.width,
      height: ghost?.height ?? n.height,
    };
  };

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
          const p = resolvePose(n);
          cx.strokeRect(p.x + 0.5, p.y + 0.5, p.width, p.height);
        }
      },
    };

    const textLayer = createTextLayer<TextNode>({
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

    const selectionLayer = createSelectionOverlayLayer<Pose>({
      getSelection: () => selectionRef.current,
      getPose: (id) => {
        const n = nodesRef.current.find((x) => x.id === id);
        if (!n) return null;
        return resolvePose(n);
      },
      handles: false,
    });

    const handleLayer: RenderLayer<unknown> = {
      id: 'handle',
      label: 'Resize handle',
      draw: (cx) => {
        const id = selectionRef.current[0];
        if (!id) return;
        const n = nodesRef.current.find((x) => x.id === id);
        if (!n) return;
        const p = resolvePose(n);
        const hx = p.x + p.width;
        const hy = p.y + p.height;
        cx.fillStyle = '#fff';
        cx.strokeStyle = '#1a130d';
        cx.lineWidth = 1;
        cx.fillRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
        cx.strokeRect(hx - HANDLE / 2, hy - HANDLE / 2, HANDLE, HANDLE);
      },
    };

    runLayers(ctx, [bgLayer, textLayer, selectionLayer, handleLayer], undefined, {});
  }, [nodes, selection, overlay, resizeOverlay, edit]);

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
const move = useMove<TextNode, Pose>(moveAdapter, {
  translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
  behaviors: [snap(gridSnapStrategy<Pose>(10))],
});

// --- Edit interaction (contenteditable overlay) ---
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
    const prev = find(id)?.text ?? '';
    if (prev === text) return;
    applyBatch([createSetTextOp({ id, from: prev, to: text, label: 'Edit text' })]);
  },
});

// --- Pointer routing: click selects + starts drag, double-click edits ---
onPointerDown: hit-test → setSelection([id]) → move.start(...)
onPointerMove: move.move(...)
onPointerUp:   move.end()
onDoubleClick: hit-test → caretIndexAt(ctx, x, y, pose) → edit.startEdit(id, { caret })

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
