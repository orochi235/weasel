import { useCallback, useEffect, useRef, useState } from 'react';
import {
  useResizeInteraction,
  useMoveInteraction,
  pathPoseGeometry,
  pathOriginProjection,
  polygonFromPoints,
  translatePath,
  boundsOfPath,
  traceToContext,
  setupCanvasDpr,
  snap,
  gridSnapStrategy,
} from '@orochi235/weasel';
import type {
  Path,
  ResizeAdapter,
  ResizeAnchor,
  MoveAdapter,
  Op,
} from '@orochi235/weasel';
import { clientToCanvas } from '../canvasCoords';

const W = 400, H = 300, HANDLE = 8;

const INITIAL_PATH: Path = polygonFromPoints(
  [
    { x: 80, y: 200 },
    { x: 200, y: 60 },
    { x: 320, y: 200 },
    { x: 260, y: 240 },
    { x: 140, y: 240 },
  ],
);

export function PathPoseDemo() {
  const [path, setPath] = useState<Path>(INITIAL_PATH);
  const pathRef = useRef(path);
  pathRef.current = path;

  const resizeAdapter: ResizeAdapter<{ id: string }, Path> = {
    getObject: (id) => (id === 'p' ? { id } : undefined),
    getPose: () => pathRef.current,
    setPose: (_id, p) => setPath(p),
    applyBatch: (ops: Op[]) => { for (const op of ops) op.apply(resizeAdapter); },
  };
  const moveAdapter: MoveAdapter<{ id: string }, Path> = {
    getObject: (id) => (id === 'p' ? { id } : undefined),
    getPose: () => pathRef.current,
    getParent: () => null,
    setPose: (_id, p) => setPath(p),
    setParent: () => {},
    applyBatch: (ops: Op[]) => { for (const op of ops) op.apply(moveAdapter); },
  };

  const resize = useResizeInteraction<{ id: string }, Path>(resizeAdapter, {
    geometry: pathPoseGeometry,
  });
  const moveI = useMoveInteraction<{ id: string }, Path>(moveAdapter, {
    translatePose: translatePath,
    behaviors: [
      snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection })),
    ],
  });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeAnchor = useRef<ResizeAnchor | null>(null);
  const dragging = useRef(false);

  const handlesOf = (p: Path): { cx: number; cy: number; anchor: ResizeAnchor }[] => {
    const b = boundsOfPath(p);
    return [
      { cx: b.x,           cy: b.y,            anchor: { x: 'max', y: 'max' } },
      { cx: b.x + b.width, cy: b.y,            anchor: { x: 'min', y: 'max' } },
      { cx: b.x,           cy: b.y + b.height, anchor: { x: 'max', y: 'min' } },
      { cx: b.x + b.width, cy: b.y + b.height, anchor: { x: 'min', y: 'min' } },
    ];
  };

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    for (const h of handlesOf(pathRef.current)) {
      if (Math.abs(wx - h.cx) <= HANDLE && Math.abs(wy - h.cy) <= HANDLE) {
        activeAnchor.current = h.anchor;
        e.currentTarget.setPointerCapture(e.pointerId);
        resize.start('p', h.anchor, wx, wy);
        return;
      }
    }
    // Otherwise: hit-test the polygon's bounding box for a body drag.
    const b = boundsOfPath(pathRef.current);
    if (wx >= b.x && wx <= b.x + b.width && wy >= b.y && wy <= b.y + b.height) {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      moveI.start({ ids: ['p'], worldX: wx, worldY: wy, clientX: e.clientX, clientY: e.clientY });
    }
  }, [moveI, resize]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const [wx, wy] = clientToCanvas(e.currentTarget, e.clientX, e.clientY);
    const mods = { alt: e.altKey, shift: e.shiftKey, meta: e.metaKey, ctrl: e.ctrlKey };
    if (activeAnchor.current) {
      resize.move(wx, wy, mods);
    } else if (dragging.current) {
      moveI.move({ worldX: wx, worldY: wy, clientX: e.clientX, clientY: e.clientY, modifiers: mods });
    }
  }, [moveI, resize]);

  const onPointerUp = useCallback(() => {
    if (activeAnchor.current) {
      activeAnchor.current = null;
      resize.end();
    } else if (dragging.current) {
      dragging.current = false;
      moveI.end();
    }
  }, [moveI, resize]);

  const resizeOverlay = resize.overlay;
  const moveOverlay = moveI.overlay;
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    setupCanvasDpr(c, ctx, W, H);
    ctx.clearRect(0, 0, W, H);

    const drawn = (resizeOverlay?.currentPose as Path | undefined)
      ?? (moveOverlay?.poses.get('p') as Path | undefined)
      ?? path;

    ctx.fillStyle = '#7fb069';
    ctx.strokeStyle = '#1a130d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    traceToContext(ctx, drawn);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#d4c4a8';
    for (const h of handlesOf(drawn)) {
      ctx.fillRect(h.cx - HANDLE / 2, h.cy - HANDLE / 2, HANDLE, HANDLE);
      ctx.strokeRect(h.cx - HANDLE / 2, h.cy - HANDLE / 2, HANDLE, HANDLE);
    }
  }, [path, resizeOverlay, moveOverlay]);

  return (
    <canvas
      ref={canvasRef}
      className="ckd-canvas"
      width={W}
      height={H}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  );
}

export const PATH_POSE_DEMO_SOURCE = `// --- Scene: pose IS a Path (no rect translation step) ---
const [path, setPath] = useState<Path>(polygonFromPoints([...]));

// --- Resize: plug in pathPoseGeometry so the hook reads/writes Path bounds ---
const resize = useResizeInteraction<{ id: string }, Path>(adapter, {
  geometry: pathPoseGeometry,
});

// --- Move: translatePath + grid-snap via pathOriginProjection ---
const move = useMoveInteraction<{ id: string }, Path>(adapter, {
  translatePose: translatePath,
  behaviors: [
    snap(gridSnapStrategy<Path>(20, { origin: pathOriginProjection })),
  ],
});

// Render via the canvas trace helper:
ctx.beginPath();
traceToContext(ctx, path);
ctx.fill();
`;
