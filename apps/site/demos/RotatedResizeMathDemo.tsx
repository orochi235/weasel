/**
 * RotatedResizeMathDemo — pedagogical "what can go wrong with rotated-resize
 * math" explainer. Four parallel rect panels each apply a different
 * `PoseProjection` to the SAME drag input, so one corner-drag drives four
 * diverging poses. A fifth panel stacks them at 60% opacity; a sixth panel
 * shows the per-component median of the three broken poses (triple modular
 * redundancy → recovers the correct green pose, frame-by-frame).
 *
 * ## Post-purge architecture
 *
 * The pre-purge version used the `useResize` hook to instantiate four
 * `ResizeController`s, one per descriptor, and broadcast a single drag to
 * all four. `useResize` is gone; resize math now lives in the dispatcher's
 * `resizeAction` driven by the `resizePolicy` dep.
 *
 * Driving four scenes' dispatchers from one input would require either
 * cross-scene event injection (no clean API) or four mutually-coordinated
 * `selectTool` instances. Both fight the kit's design.
 *
 * **Chosen mechanism:** the demo owns the *routing* of one gesture to four
 * scenes; the gesture itself runs on the kit's `useHandleDrag`. A parent
 * pointerdown handler hit-tests corner handles and captures the start state
 * for all four scenes, then hands the press to `useHandleDrag`, which owns
 * capture, pointer identity and teardown. Each move computes a proposed pose
 * per scene by running the same math the kit's `resizeAction` runs —
 * `computeProposedBounds` + `geometry.remapBounds` + the rotation-pin
 * correction — using each scene's own `PoseProjection`, and calls that
 * scene's `setPose`. On release the scenes' batched history captures the
 * gesture.
 *
 * This bypasses `SceneCanvas`'s built-in dispatcher entirely
 * (`enableGestureDispatcher={false}`); the four canvases are pure renderers.
 * The math runs in this file because the demo's pedagogy is precisely that
 * math — substituting a broken descriptor for each panel is the whole point.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_HANDLE_SIZE,
  SceneCanvas,
  clientToCanvas,
  pointInRotatedRect,
  ROTATED_POSE_DESCRIPTOR,
  RECT_POSE_DESCRIPTOR,
  rotatePoint,
  useHandleDrag,
  useScene,
  cornerResizeHandles,
  hitCornerHandle,
  asNodeId,
} from '@weasel-js/core';
import type {
  HandleDragEnd,
  HandleDragPoint,
  PoseProjection,
  RotatedPose,
  ResizeAnchor,
  ResizePose,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';

type PanelId = 'green' | 'orange' | 'purple' | 'teal';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 320, H = 240, HANDLE = DEFAULT_HANDLE_SIZE;

const INITIAL_GREEN: Rect = { id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#7fb069' };
const INITIAL_ORANGE: Rect = { ...INITIAL_GREEN, color: '#d4a574' };
const INITIAL_PURPLE: Rect = { ...INITIAL_GREEN, color: '#a48bd4' };
const INITIAL_TEAL: Rect = { ...INITIAL_GREEN, color: '#5b9aa0' };

// drawOne returns unrotated geometry; SceneCanvas wraps the output in a
// rotation transform when `pose.rotation` is set (see
// `wrapWithPoseRotation` in `src/canvas/poseRotation.ts`).
function drawRect(_node: unknown, p: Rect): DrawCommand[] {
  return [{
    kind: 'path',
    path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
    fill: { color: p.color },
  }];
}

/** Subverted descriptor: pose carries rotation, but `getRotation` lies and
 *  returns 0 → kit's resize math takes the unrotated path; drag delta is
 *  applied in world frame instead of being projected by `R(-θ)`. Visible
 *  failure: rect distorts as world-axis scale fights the rotation. */
const NO_PROJECTION_DESCRIPTOR: PoseProjection<Rect> = {
  ...(RECT_POSE_DESCRIPTOR as unknown as PoseProjection<Rect>),
  getRotation: () => 0,
};

/** Subverted descriptor: rotation is read normally (so projection runs), but
 *  `translate` is a no-op. Visible failure: rect scales correctly in local
 *  frame, but the post-remap fixed-corner correction never lands, so the
 *  AABB center stays anchored and the perceived "fixed corner" drifts. */
const NO_CORRECTION_DESCRIPTOR: PoseProjection<Rect> = {
  ...(ROTATED_POSE_DESCRIPTOR as unknown as PoseProjection<Rect>),
  translate: (p) => p,
};

/** Subverted descriptor: projection + correction both run, but `remapBounds`
 *  couples the rotation property to the AABB diagonal angle, which changes
 *  whenever the aspect ratio does. Visible failure: as you resize, the rect
 *  rotates — the rotation pivot effectively follows the diagonal. The correct
 *  behavior keeps rotation orthogonal to bounds so the gesture only changes
 *  shape. */
const COUPLED_ROTATION_DESCRIPTOR: PoseProjection<Rect> = {
  ...(ROTATED_POSE_DESCRIPTOR as unknown as PoseProjection<Rect>),
  remapBounds: (origin: Rect, originBounds: ResizePose, newBounds: ResizePose): Rect => {
    const base = (ROTATED_POSE_DESCRIPTOR as unknown as PoseProjection<Rect>)
      .remapBounds(origin, originBounds, newBounds);
    const originDiag = Math.atan2(originBounds.height, originBounds.width);
    const newDiag = Math.atan2(newBounds.height, newBounds.width);
    return { ...base, rotation: base.rotation + (newDiag - originDiag) };
  },
};

const GRID = {
  spacing: 20,
  bounds: () => ({ x: 0, y: 0, width: W, height: H }),
  accentEvery: 5,
} as const;

// ─── Resize math (mirrors `src/interactions/actions/defaults/resize.ts`) ───

/** World-frame `(dx, dy)` projected by `R(-rotation)`, then anchor-relative
 *  bounds math applied in the local frame. Matches `computeProposedBounds` in
 *  the kit's `resizeAction` invoker. */
function computeProposedBounds(
  ob: ResizePose,
  anchor: ResizeAnchor,
  dx: number,
  dy: number,
  rotation: number,
): ResizePose {
  if (rotation !== 0) {
    const cs = Math.cos(-rotation);
    const sn = Math.sin(-rotation);
    const dxL = cs * dx - sn * dy;
    const dyL = sn * dx + cs * dy;
    dx = dxL;
    dy = dyL;
  }
  let nx = ob.x, ny = ob.y, nw = ob.width, nh = ob.height;
  if (anchor.x === 'min') nw = ob.width + dx;
  else if (anchor.x === 'max') { nx = ob.x + dx; nw = ob.width - dx; }
  if (anchor.y === 'min') nh = ob.height + dy;
  else if (anchor.y === 'max') { ny = ob.y + dy; nh = ob.height - dy; }
  return { x: nx, y: ny, width: nw, height: nh };
}

function fixedCorner(bounds: ResizePose, anchor: ResizeAnchor): { x: number; y: number } {
  return {
    x: anchor.x === 'max' ? bounds.x + bounds.width : bounds.x,
    y: anchor.y === 'max' ? bounds.y + bounds.height : bounds.y,
  };
}

/** World-space fixed corner of a rotated rect for the given anchor. */
function fixedCornerWorld(pose: Rect, anchor: ResizeAnchor): { x: number; y: number } {
  const local = fixedCorner(pose, anchor);
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  return rotatePoint(local.x, local.y, cx, cy, pose.rotation);
}

/** Apply one frame of resize to `startPose` through `geometry`. Mirrors the
 *  kit's resizeAction invoker `onMove` path for the single-id case. */
function runResize(
  geometry: PoseProjection<Rect>,
  startPose: Rect,
  anchor: ResizeAnchor,
  dx: number,
  dy: number,
): Rect {
  const originBounds = geometry.getBounds(startPose);
  const rotation = geometry.getRotation?.(startPose) ?? 0;
  const proposedBounds = computeProposedBounds(originBounds, anchor, dx, dy, rotation);
  let proposed = geometry.remapBounds(startPose, originBounds, proposedBounds);
  if (rotation !== 0) {
    const startFixedLocal = fixedCorner(originBounds, anchor);
    const startFixedWorld = rotatePoint(
      startFixedLocal.x, startFixedLocal.y,
      originBounds.x + originBounds.width / 2,
      originBounds.y + originBounds.height / 2,
      rotation,
    );
    const newFixedLocal = fixedCorner(proposedBounds, anchor);
    const newFixedWorld = rotatePoint(
      newFixedLocal.x, newFixedLocal.y,
      proposedBounds.x + proposedBounds.width / 2,
      proposedBounds.y + proposedBounds.height / 2,
      rotation,
    );
    const cxCorrection = startFixedWorld.x - newFixedWorld.x;
    const cyCorrection = startFixedWorld.y - newFixedWorld.y;
    const translate = geometry.translate
      ?? ((p: Rect, tx: number, ty: number): Rect => ({ ...p, x: p.x + tx, y: p.y + ty }));
    proposed = translate(proposed, cxCorrection, cyCorrection);
  }
  return proposed;
}

// ─── Tiny presentational helpers ───

function LedgerCaption({
  pose, anchor, title,
}: {
  pose: Rect;
  anchor: ResizeAnchor;
  title: string;
}) {
  const w = fixedCornerWorld(pose, anchor);
  return (
    <div className="rrmd-caption">
      <div className="rrmd-caption-title">{title}</div>
      <div className="rrmd-caption-body">fixed corner: ({w.x.toFixed(1)}, {w.y.toFixed(1)})</div>
    </div>
  );
}

function OverlayLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rrmd-caption">
      <div className="rrmd-caption-title">{title}</div>
      {subtitle && <div className="rrmd-caption-body">{subtitle}</div>}
    </div>
  );
}

function GhostRect({ pose, color }: { pose: Rect; color: string }) {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const deg = (pose.rotation * 180) / Math.PI;
  return (
    <svg width={W} height={H} className="rrmd-ghost">
      <rect
        x={pose.x}
        y={pose.y}
        width={pose.width}
        height={pose.height}
        fill={color}
        fillOpacity={0.18}
        stroke={color}
        strokeWidth={1.5}
        strokeDasharray="4 3"
        transform={`rotate(${deg} ${cx} ${cy})`}
      />
    </svg>
  );
}

function FixedCornerMarkers({
  origin, current, color,
}: {
  origin: { x: number; y: number } | null;
  current: { x: number; y: number } | null;
  color: string;
}) {
  if (!origin && !current) return null;
  return (
    <svg width={W} height={H} className="rrmd-ghost">
      {origin && <circle cx={origin.x} cy={origin.y} r={6} fill="none" stroke="white" strokeWidth={1.5} />}
      {current && <circle cx={current.x} cy={current.y} r={4} fill={color} stroke="white" strokeWidth={1} />}
    </svg>
  );
}

// ─── Panels ───

interface PanelProps {
  scene: ReturnType<typeof useScene<Rect>>;
  livePose: Rect | null;
  ghostColor: string;
  fixedOrigin: { x: number; y: number } | null;
  anchor: ResizeAnchor | null;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  title: string;
  showHandles: boolean;
}

function Panel({
  scene, livePose, ghostColor, fixedOrigin, anchor, onPointerDown, title, showHandles,
}: PanelProps) {
  const node = scene.get(asNodeId('a'));
  const committed = node?.pose as Rect | undefined;
  // In-flight pose: while a drag is active this panel's projected proposed
  // pose. When idle, the scene's committed pose.
  const displayed = livePose ?? committed;
  return (
    <div
      onPointerDownCapture={onPointerDown}
      className="rrmd-panel"
    >
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        enableGestureDispatcher={false}
        layers={{
          grid: GRID,
          scene: { drawOne: drawRect },
          selectionOverlay: null,
        }}
      />
      {/* Corner-handle dots for the green panel — purely cosmetic; the
          parent wrapper hit-tests against `cornerResizeHandles(refPose)`
          rotated into local frame. */}
      {showHandles && committed && <CornerHandleDots pose={committed} />}
      {livePose && <GhostRect pose={livePose} color={ghostColor} />}
      <FixedCornerMarkers
        origin={fixedOrigin}
        current={anchor && displayed ? fixedCornerWorld(displayed, anchor) : null}
        color={ghostColor}
      />
      {displayed && anchor && (
        <LedgerCaption pose={displayed} anchor={anchor} title={title} />
      )}
      {displayed && !anchor && (
        <LedgerCaption pose={displayed} anchor={{ x: 'min', y: 'min' }} title={title} />
      )}
    </div>
  );
}

function CornerHandleDots({ pose }: { pose: Rect }) {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const corners = cornerResizeHandles(pose).map((h) => {
    const w = rotatePoint(h.cx, h.cy, cx, cy, pose.rotation);
    return { ...w, anchor: h.anchor };
  });
  return (
    <svg width={W} height={H} className="rrmd-ghost">
      {corners.map((c, i) => (
        <rect
          key={i}
          x={c.x - HANDLE / 2}
          y={c.y - HANDLE / 2}
          width={HANDLE}
          height={HANDLE}
          fill="white"
          stroke="#333"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}

function StackedOverlayPanel({
  poses,
}: {
  poses: { green: Rect; orange: Rect; purple: Rect; teal: Rect };
}) {
  const order: Array<keyof typeof poses> = ['orange', 'purple', 'teal', 'green'];
  return (
    <div className="rrmd-panel">
      <svg width={W} height={H} className="ckd-canvas rrmd-overlay-svg">
        {order.map((k) => {
          const p = poses[k];
          const cx = p.x + p.width / 2;
          const cy = p.y + p.height / 2;
          const deg = (p.rotation * 180) / Math.PI;
          const isGreen = k === 'green';
          return (
            <rect
              key={k}
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.height}
              fill={p.color}
              fillOpacity={0.5}
              stroke={isGreen ? 'white' : 'none'}
              strokeWidth={isGreen ? 1.5 : 0}
              strokeDasharray={isGreen ? '4 3' : undefined}
              transform={`rotate(${deg} ${cx} ${cy})`}
            />
          );
        })}
      </svg>
      <OverlayLabel title="Live overlay" subtitle="all four stacked at 60% opacity" />
    </div>
  );
}

function median3(x: number, y: number, z: number): number {
  if (x > y) [x, y] = [y, x];
  if (y > z) [y, z] = [z, y];
  if (x > y) [x, y] = [y, x];
  return y;
}

function medianPose(a: Rect, b: Rect, c: Rect): Rect {
  return {
    id: a.id,
    color: a.color,
    x: median3(a.x, b.x, c.x),
    y: median3(a.y, b.y, c.y),
    width: median3(a.width, b.width, c.width),
    height: median3(a.height, b.height, c.height),
    rotation: median3(a.rotation, b.rotation, c.rotation),
  };
}

function MedianPanel({
  orange, purple, teal,
}: {
  orange: Rect; purple: Rect; teal: Rect;
}) {
  const m = medianPose(orange, purple, teal);
  const cx = m.x + m.width / 2;
  const cy = m.y + m.height / 2;
  const deg = (m.rotation * 180) / Math.PI;
  const greenColor = INITIAL_GREEN.color;
  return (
    <div className="rrmd-panel">
      <svg width={W} height={H} className="ckd-canvas rrmd-overlay-svg">
        <rect
          x={m.x}
          y={m.y}
          width={m.width}
          height={m.height}
          fill={greenColor}
          fillOpacity={0.5}
          stroke="white"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          transform={`rotate(${deg} ${cx} ${cy})`}
        />
      </svg>
      <OverlayLabel title="Median(orange, purple, teal)" subtitle="per-component recovers green" />
    </div>
  );
}

// ─── Root demo ───

interface DragState {
  anchor: ResizeAnchor | null;  // null = body-translate
  startPt: { x: number; y: number };
  startPoses: Record<PanelId, Rect>;
}

const PROJECTIONS: Record<PanelId, PoseProjection<Rect>> = {
  green: ROTATED_POSE_DESCRIPTOR as unknown as PoseProjection<Rect>,
  orange: NO_PROJECTION_DESCRIPTOR,
  purple: NO_CORRECTION_DESCRIPTOR,
  teal: COUPLED_ROTATION_DESCRIPTOR,
};

const PANEL_IDS: PanelId[] = ['green', 'orange', 'purple', 'teal'];

export function RotatedResizeMathDemo() {
  const greenScene = useScene<Rect>({ items: [INITIAL_GREEN] });
  const orangeScene = useScene<Rect>({ items: [INITIAL_ORANGE] });
  const purpleScene = useScene<Rect>({ items: [INITIAL_PURPLE] });
  const tealScene = useScene<Rect>({ items: [INITIAL_TEAL] });

  const scenes: Record<PanelId, ReturnType<typeof useScene<Rect>>> = useMemo(() => ({
    green: greenScene, orange: orangeScene, purple: purpleScene, teal: tealScene,
  }), [greenScene, orangeScene, purpleScene, tealScene]);

  // Start state of the gesture in flight, in a ref so the drag callbacks read
  // the current value rather than the render they were created in.
  const dragRef = useRef<DragState | null>(null);

  // Per-panel in-flight pose for the active gesture (null when idle). Lives
  // in React state so panels + overlays re-render on each move, and is
  // mirrored into a ref so the commit reads the CURRENT value.
  const [live, setLive] = useState<Record<PanelId, Rect> | null>(null);
  const liveRef = useRef<Record<PanelId, Rect> | null>(null);
  const updateLive = useCallback((v: Record<PanelId, Rect> | null) => {
    liveRef.current = v;
    setLive(v);
  }, []);
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [originFixed, setOriginFixed] = useState<{ x: number; y: number } | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<ResizeAnchor | null>(null);

  const COLORS: Record<PanelId, string> = {
    green: INITIAL_GREEN.color,
    orange: INITIAL_ORANGE.color,
    purple: INITIAL_PURPLE.color,
    teal: INITIAL_TEAL.color,
  };
  const ghostColorFor = (panel: PanelId): string =>
    activePanel ? COLORS[activePanel] : COLORS[panel];

  /** Canvas-local coords of a press, or null if it landed outside the canvas. */
  const pressCoords = (
    e: React.PointerEvent,
    wrapper: Element,
  ): { x: number; y: number } | null => {
    const canvas = wrapper.querySelector('canvas');
    if (!canvas) return null;
    const [x, y] = clientToCanvas(canvas, e.clientX, e.clientY);
    const rect = canvas.getBoundingClientRect();
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y };
  };

  const handleMove = useCallback((pt: HandleDragPoint) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = pt.x - drag.startPt.x;
    const dy = pt.y - drag.startPt.y;
    const next: Record<PanelId, Rect> = { ...drag.startPoses };
    if (drag.anchor) {
      for (const panel of PANEL_IDS) {
        next[panel] = runResize(PROJECTIONS[panel], drag.startPoses[panel], drag.anchor, dx, dy);
      }
    } else {
      for (const panel of PANEL_IDS) {
        const p = drag.startPoses[panel];
        next[panel] = { ...p, x: p.x + dx, y: p.y + dy };
      }
    }
    updateLive(next);
  }, [updateLive]);

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    setActivePanel(null);
    setOriginFixed(null);
    setActiveAnchor(null);
    updateLive(null);
  }, [updateLive]);

  const handleEnd = useCallback(({ moved }: HandleDragEnd) => {
    // Commit each scene's live pose as the new committed pose via batch. Read
    // through the ref, not the `live` state: this closure predates every move
    // of the gesture.
    const finalPoses = liveRef.current;
    if (moved && finalPoses) {
      for (const panel of PANEL_IDS) {
        const scene = scenes[panel];
        const finalPose = finalPoses[panel];
        scene.batch('Resize', () => {
          scene.setPose(asNodeId('a'), finalPose);
        });
      }
    }
    clearDrag();
  }, [clearDrag, scenes]);

  const handleDrag = useHandleDrag<HTMLDivElement>({
    // Coords are canvas-local; the wrapper also holds the caption and ghosts.
    getRect: (wrapper) => wrapper.querySelector('canvas') ?? wrapper,
    onMove: handleMove,
    onEnd: handleEnd,
    onCancel: clearDrag,
  });

  const handlePointerDown = useCallback((panel: PanelId, e: React.PointerEvent<HTMLDivElement>) => {
    const wrapper = e.currentTarget;
    const pt = pressCoords(e, wrapper);
    if (!pt) return;
    // Hit-test handles against the GREEN canonical pose. The four panels
    // start with the same initial pose, so the hit is meaningful even when
    // the user clicks on another panel's wrapper — and we always broadcast
    // to all four scenes regardless of which one started the drag.
    const ref = greenScene.get(asNodeId('a'));
    if (!ref) return;
    const refPose = ref.pose as Rect;
    const cx = refPose.x + refPose.width / 2;
    const cy = refPose.y + refPose.height / 2;
    // Rotate the click into local frame for handle hit-testing.
    const local = rotatePoint(pt.x, pt.y, cx, cy, -refPose.rotation);
    e.stopPropagation();
    e.preventDefault();

    const handles = cornerResizeHandles(refPose);
    let hitAnchor: ResizeAnchor | null = null;
    for (const h of handles) {
      if (hitCornerHandle(h, local.x, local.y, HANDLE)) {
        hitAnchor = h.anchor;
        break;
      }
    }

    const startPoses: Record<PanelId, Rect> = {
      green: greenScene.get(asNodeId('a'))!.pose as Rect,
      orange: orangeScene.get(asNodeId('a'))!.pose as Rect,
      purple: purpleScene.get(asNodeId('a'))!.pose as Rect,
      teal: tealScene.get(asNodeId('a'))!.pose as Rect,
    };

    if (!hitAnchor) {
      // Body-translate only from green (canonical) panel.
      if (panel !== 'green') return;
      if (!pointInRotatedRect(refPose, pt.x, pt.y)) return;
    }

    // Opened before the state below is written: a session still live from a
    // release this page never saw is cancelled here, and its `onCancel` runs
    // `clearDrag` — which would wipe the gesture we are starting.
    handleDrag.onPointerDown(e);

    dragRef.current = { anchor: hitAnchor, startPt: pt, startPoses };
    setActivePanel(panel);
    if (hitAnchor) setActiveAnchor(hitAnchor);
    if (hitAnchor) setOriginFixed(fixedCornerWorld(refPose, hitAnchor));
    updateLive(startPoses);
  }, [greenScene, orangeScene, purpleScene, tealScene, handleDrag, updateLive]);

  const livePose = (panel: PanelId): Rect | null => live?.[panel] ?? null;
  const displayedPose = (panel: PanelId): Rect => live?.[panel]
    ?? (scenes[panel].get(asNodeId('a'))!.pose as Rect);

  return (
    <div>
      <style>{`
        .rrmd-panel { position: relative; touch-action: none; }
        .rrmd-ghost { position: absolute; top: 0; left: 0; pointer-events: none; overflow: visible; }
        .rrmd-overlay-svg { display: block; pointer-events: none; overflow: visible; }
        .rrmd-caption {
          position: absolute; left: 6px; bottom: 6px;
          padding: 4px 6px; font-size: 11px; font-family: monospace;
          color: #e8e8e8; background: rgba(0,0,0,0.55);
          border-radius: 3px; pointer-events: none; line-height: 1.3;
        }
        .rrmd-caption-title { font-weight: 600; }
        .rrmd-caption-body { opacity: 0.85; }
        .rrmd-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
      `}</style>
      <header>
        <h2>Rotated resize: the math, with counterexamples</h2>
        <p>
          Resizing a rotated rect requires three coordinated steps, and a
          fourth discipline: keep the rotation property orthogonal to the
          resize. Each panel below runs the same drag against its own
          starting pose, but uses a different <code>PoseProjection</code> &mdash;
          three are subverted. Drag any corner handle in the green panel
          and all four rects resize in lockstep, each through its own
          projection, so one input drives four diverging outputs. The
          &ldquo;fixed corner&rdquo; ledger below each panel should stay
          constant in the full-math panel; it drifts in the counterexamples.
        </p>
        <ul>
          <li><strong>Full math (green):</strong> drag projected into local frame, anchor math runs there, position is corrected so the diagonal corner stays pinned, rotation preserved.</li>
          <li><strong>No projection (orange):</strong> drag delta applied in world frame &mdash; rect distorts under rotation.</li>
          <li><strong>No correction (purple):</strong> projection on, but the post-remap fixed-corner correction is a no-op &mdash; the perceived fixed corner drifts.</li>
          <li><strong>Coupled rotation (teal):</strong> remap couples rotation to the AABB diagonal angle &mdash; rect rotates as you resize.</li>
          <li><strong>Live overlay:</strong> all four stacked at 60% opacity so divergence shows as color separation.</li>
          <li><strong>Median panel:</strong> per-component median of orange + purple + teal. Each broken descriptor differs from green in exactly one component, so the median recovers green frame-by-frame &mdash; triple modular redundancy.</li>
        </ul>
      </header>
      <div className="rrmd-grid">
        <Panel
          title="Full math (drag me)"
          showHandles
          scene={greenScene}
          livePose={livePose('green')}
          ghostColor={ghostColorFor('green')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
          onPointerDown={(e) => handlePointerDown('green', e)}
        />
        <Panel
          title="No projection — world-frame delta"
          showHandles={false}
          scene={orangeScene}
          livePose={livePose('orange')}
          ghostColor={ghostColorFor('orange')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
        />
        <Panel
          title="No correction — anchor drifts"
          showHandles={false}
          scene={purpleScene}
          livePose={livePose('purple')}
          ghostColor={ghostColorFor('purple')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
        />
        <Panel
          title="Coupled rotation — pivot follows size"
          showHandles={false}
          scene={tealScene}
          livePose={livePose('teal')}
          ghostColor={ghostColorFor('teal')}
          fixedOrigin={originFixed}
          anchor={activeAnchor}
        />
        <StackedOverlayPanel
          poses={{
            green: displayedPose('green'),
            orange: displayedPose('orange'),
            purple: displayedPose('purple'),
            teal: displayedPose('teal'),
          }}
        />
        <MedianPanel
          orange={displayedPose('orange')}
          purple={displayedPose('purple')}
          teal={displayedPose('teal')}
        />
      </div>
    </div>
  );
}

export default RotatedResizeMathDemo;
