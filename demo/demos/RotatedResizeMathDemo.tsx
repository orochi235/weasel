import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  pointInRotatedRect,
  ROTATED_POSE_DESCRIPTOR,
  RECT_POSE_DESCRIPTOR,
  rotatePoint,
  useScene,
  useResize,
  cornerResizeHandles,
  hitCornerHandle,
  asNodeId,
} from '@orochi235/weasel';
import type {
  PoseDescriptor,
  RotatedPose,
  ResizeAnchor,
  ResizeController,
  ModifierState,
} from '@orochi235/weasel';
import type { ResizeAdapter } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

type RectScene = ReturnType<typeof useScene<Rect>>;
type PanelId = 'green' | 'orange' | 'purple' | 'teal';

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 320, H = 240, HANDLE = 8;

const INITIAL_GREEN: Rect[] = [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#7fb069' }];
const INITIAL_ORANGE: Rect[] = [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#d4a574' }];
const INITIAL_PURPLE: Rect[] = [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#a48bd4' }];
const INITIAL_TEAL: Rect[] = [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#5b9aa0' }];

function drawRect(_node: unknown, p: Rect): DrawCommand[] {
  const cxw = p.x + p.width / 2;
  const cyw = p.y + p.height / 2;
  const cs = Math.cos(p.rotation);
  const sn = Math.sin(p.rotation);
  const a = cs, b = sn, c = -sn, d = cs;
  const tx = cxw - a * cxw - c * cyw;
  const ty = cyw - b * cxw - d * cyw;
  const transform = new Float32Array([a, b, 0, c, d, 0, tx, ty, 1]);
  return [{
    kind: 'group',
    transform,
    children: [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { color: p.color },
    }],
  }];
}

function pickEveryFor(scene: RectScene) {
  return (wx: number, wy: number): string | null => {
    const ordered = [...scene.renderOrder()];
    for (let i = ordered.length - 1; i >= 0; i--) {
      const n = scene.get(ordered[i]);
      if (n && pointInRotatedRect(n.pose, wx, wy)) return n.id;
    }
    return null;
  };
}


/** Subverted descriptor: pose carries rotation, but `getRotation` lies and
 *  returns 0. `useResize` takes the unrotated path; drag delta is applied
 *  without `R(−θ)` projection. Visible failure: leaf distorts as world-axis
 *  scale fights the rotation. */
const NO_PROJECTION_DESCRIPTOR = {
  ...RECT_POSE_DESCRIPTOR,
  getRotation: () => 0,
} as unknown as PoseDescriptor<Rect>;

/** Subverted descriptor: rotation is read normally (so projection runs), but
 *  `translate` refuses to apply the position correction. Visible failure:
 *  leaf scales correctly in local frame, but the AABB center stays anchored,
 *  so the user-perceived "fixed corner" drifts. */
const NO_CORRECTION_DESCRIPTOR = {
  ...ROTATED_POSE_DESCRIPTOR,
  translate: (p: RotatedPose) => p,  // no-op
} as unknown as PoseDescriptor<Rect>;

/** Subverted descriptor: full math runs (projection + correction), but
 *  `remapBounds` couples the rotation property to the AABB diagonal angle,
 *  which changes whenever the aspect ratio does. Visible failure: as you
 *  resize, the rect rotates — the rotation pivot effectively follows the
 *  diagonal as the rect's shape changes. The kit's correct behavior keeps
 *  rotation orthogonal to bounds so the gesture only changes shape. */
const COUPLED_ROTATION_DESCRIPTOR = {
  ...ROTATED_POSE_DESCRIPTOR,
  remapBounds: (origin: Rect, originBounds: { x: number; y: number; width: number; height: number }, newBounds: { x: number; y: number; width: number; height: number }): Rect => {
    const base = (ROTATED_POSE_DESCRIPTOR as unknown as PoseDescriptor<Rect>).remapBounds(origin, originBounds, newBounds);
    const originDiag = Math.atan2(originBounds.height, originBounds.width);
    const newDiag = Math.atan2(newBounds.height, newBounds.width);
    return { ...base, rotation: base.rotation + (newDiag - originDiag) };
  },
} as unknown as PoseDescriptor<Rect>;

function LedgerCaption({
  scene, anchor, title,
}: {
  scene: RectScene;
  anchor: { x: 'min' | 'max'; y: 'min' | 'max' };
  title: string;
}) {
  const node = scene.get(asNodeId('a'));
  if (!node) return null;
  const p = node.pose;
  const cx = p.x + p.width / 2;
  const cy = p.y + p.height / 2;
  // Convention matches fixedCornerOf: anchor 'min' on an axis means the min
  // edge is the fixed anchor, so the fixed corner sits at bounds.x (or .y).
  const localX = anchor.x === 'min' ? p.x : p.x + p.width;
  const localY = anchor.y === 'min' ? p.y : p.y + p.height;
  const w = rotatePoint(localX, localY, cx, cy, p.rotation);
  return (
    <div
      style={{
        position: 'absolute',
        left: 6,
        bottom: 6,
        padding: '4px 6px',
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#e8e8e8',
        background: 'rgba(0,0,0,0.55)',
        borderRadius: 3,
        pointerEvents: 'none',
        lineHeight: 1.3,
      }}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ opacity: 0.85 }}>fixed corner: ({w.x.toFixed(1)}, {w.y.toFixed(1)})</div>
    </div>
  );
}

/** Build a minimal `ResizeAdapter` over a scene. Resize-only — no
 *  hit-testing, no selection: the unified parent driver in
 *  `RotatedResizeMathDemo` owns those concerns and just needs each controller
 *  to read/write pose on its scene. */
const adapterForScene = (scene: RectScene): ResizeAdapter<{ id: string }, Rect> => ({
  getNode: (id) => {
    const n = scene.get(asNodeId(id));
    return n ? { id: n.id } : undefined;
  },
  getPose: (id) => {
    const n = scene.get(asNodeId(id));
    if (!n) throw new Error(`adapterForScene: unknown node "${id}"`);
    return n.pose as Rect;
  },
  setPose: (id, pose) => {
    scene.setPose(asNodeId(id), pose);
  },
  applyOps: (ops, label) => {
    scene.batch(label, () => {
      // The adapter fed to op.apply only needs setPose for transform ops.
      const opAdapter = {
        setPose: (id: string, pose: Rect) => {
          scene.setPose(asNodeId(id), pose);
        },
      };
      for (const op of ops) op.apply(opAdapter as never);
    });
  },
});

/** Translucent in-flight preview of a proposed rect pose. Rendered above
 *  the canvas via an absolutely-positioned SVG; pointer-events disabled so
 *  it never blocks the wrapper's gesture handlers. The `color` overrides
 *  the pose's own color — used to tint non-active-panel ghosts with the
 *  active panel's color, marking which input drove the gesture. */
function GhostRect({ pose, color }: { pose: Rect; color: string }) {
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const deg = (pose.rotation * 180) / Math.PI;
  return (
    <svg
      width={W}
      height={H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
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

/** Fixed-corner markers: hollow circle at the gesture's origin fixed-corner
 *  position (static across the gesture) plus a filled circle at the rect's
 *  current fixed-corner position. The two should be coincident in the
 *  full-math panel and separate in the broken-math panels — that drift is
 *  precisely the invariant the demo is teaching. */
function FixedCornerMarkers({
  origin, current, color,
}: {
  origin: { x: number; y: number } | null;
  current: { x: number; y: number } | null;
  color: string;
}) {
  if (!origin && !current) return null;
  return (
    <svg
      width={W}
      height={H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
    >
      {origin && <circle cx={origin.x} cy={origin.y} r={6} fill="none" stroke="white" strokeWidth={1.5} />}
      {current && <circle cx={current.x} cy={current.y} r={4} fill={color} stroke="white" strokeWidth={1} />}
    </svg>
  );
}

/** World-space fixed corner of a rotated rect for the given anchor.
 *  Mirrors the kit's `fixedCornerOf` (in `interactions/actions/resize`,
 *  not on the public barrel) plus a rotation around the rect center. */
function fixedCornerWorld(pose: Rect, anchor: ResizeAnchor): { x: number; y: number } {
  const localX = anchor.x === 'max' ? pose.x + pose.width : pose.x;
  const localY = anchor.y === 'max' ? pose.y + pose.height : pose.y;
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  return rotatePoint(localX, localY, cx, cy, pose.rotation);
}

const GRID = {
  spacing: 20,
  bounds: () => ({ x: 0, y: 0, width: W, height: H }),
  accentEvery: 5,
} as const;

interface PanelProps {
  scene: RectScene;
  ghostPose: Rect | null;
  ghostColor: string;
  fixedOrigin: { x: number; y: number } | null;
  fixedCurrent: { x: number; y: number } | null;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  title: string;
  showHandles: boolean;
}

function Panel({
  scene, ghostPose, ghostColor, fixedOrigin, fixedCurrent, onPointerDown, title, showHandles,
}: PanelProps) {
  return (
    <div onPointerDownCapture={onPointerDown} style={{ touchAction: 'none', position: 'relative' }}>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        geometry={{ pickEvery: pickEveryFor(scene) }}
        selectionOptions={showHandles ? { initial: [asNodeId('a')] } : undefined}
        layers={{
          grid: GRID,
          scene: { drawOne: drawRect },
          selectionOverlay: { rotationHandle: false },
        }}
      />
      {ghostPose && <GhostRect pose={ghostPose} color={ghostColor} />}
      <FixedCornerMarkers origin={fixedOrigin} current={fixedCurrent} color={ghostColor} />
      <LedgerCaption scene={scene} anchor={{ x: 'min', y: 'min' }} title={title} />
    </div>
  );
}

/** Non-interactive overlay: live mirror of all three rects, 60% opacity, so
 *  divergence between the full-math panel and the counterexamples is visible
 *  at a glance without needing to compare three canvases by eye. While a
 *  drag is in progress, ghost poses (the in-flight `currentPose` from each
 *  controller's overlay) are shown instead of the committed scene poses, so
 *  the divergence animates in real time rather than only on release. */
function StackedOverlayPanel({
  green, orange, purple, teal, ghosts,
}: {
  green: RectScene; orange: RectScene; purple: RectScene; teal: RectScene;
  ghosts: { green: Rect | null; orange: Rect | null; purple: Rect | null; teal: Rect | null };
}) {
  useSyncExternalStore(green.subscribe, green.getVersion, green.getVersion);
  useSyncExternalStore(orange.subscribe, orange.getVersion, orange.getVersion);
  useSyncExternalStore(purple.subscribe, purple.getVersion, purple.getVersion);
  useSyncExternalStore(teal.subscribe, teal.getVersion, teal.getVersion);

  const pick = (s: RectScene, ghost: Rect | null): Rect | undefined =>
    ghost ?? (s.get(asNodeId('a'))?.pose as Rect | undefined);
  // Render counterexamples first, green last so its dashed outline sits on top
  // — same treatment as the median panel so "the correct one" is visually
  // identifiable in both reference panels.
  const greenPose = pick(green, ghosts.green);
  const counterexamples = [pick(orange, ghosts.orange), pick(purple, ghosts.purple), pick(teal, ghosts.teal)]
    .filter((p): p is Rect => !!p);

  return (
    <div style={{ position: 'relative' }}>
      <svg width={W} height={H} className="ckd-canvas" style={{ display: 'block', pointerEvents: 'none', overflow: 'visible' }}>
        {counterexamples.map((p, i) => {
          const cx = p.x + p.width / 2;
          const cy = p.y + p.height / 2;
          const deg = (p.rotation * 180) / Math.PI;
          return (
            <rect
              key={i}
              x={p.x}
              y={p.y}
              width={p.width}
              height={p.height}
              fill={p.color}
              fillOpacity={0.5}
              transform={`rotate(${deg} ${cx} ${cy})`}
            />
          );
        })}
        {greenPose && (() => {
          const cx = greenPose.x + greenPose.width / 2;
          const cy = greenPose.y + greenPose.height / 2;
          const deg = (greenPose.rotation * 180) / Math.PI;
          return (
            <rect
              x={greenPose.x}
              y={greenPose.y}
              width={greenPose.width}
              height={greenPose.height}
              fill={greenPose.color}
              fillOpacity={0.5}
              stroke="white"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              transform={`rotate(${deg} ${cx} ${cy})`}
            />
          );
        })()}
      </svg>
      <OverlayLabel title="Live overlay" subtitle="all four stacked at 60% opacity" />
    </div>
  );
}

function OverlayLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 6,
        bottom: 6,
        padding: '4px 6px',
        fontSize: 11,
        fontFamily: 'monospace',
        color: '#e8e8e8',
        background: 'rgba(0,0,0,0.55)',
        borderRadius: 3,
        pointerEvents: 'none',
        lineHeight: 1.3,
      }}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      {subtitle && <div style={{ opacity: 0.85 }}>{subtitle}</div>}
    </div>
  );
}

/** Per-component median of three numbers. */
function median3(x: number, y: number, z: number): number {
  if (x > y) [x, y] = [y, x];
  if (y > z) [y, z] = [z, y];
  if (x > y) [x, y] = [y, x];
  return y;
}

/** Triple modular redundancy: per-component median of three poses. Each
 *  broken descriptor in this demo differs from `correct` in exactly one
 *  component (orange wrong on width/height, purple wrong on x/y, teal
 *  wrong on rotation), so the median across the three recovers the
 *  correct pose, frame-by-frame. */
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

/** Non-interactive panel: per-component median of orange/purple/teal,
 *  rendered in green's color. Should track the green panel exactly during
 *  any drag — visual proof that the three failure modes are orthogonal. */
function MedianPanel({
  orange, purple, teal, ghosts,
}: {
  orange: RectScene; purple: RectScene; teal: RectScene;
  ghosts: { orange: Rect | null; purple: Rect | null; teal: Rect | null };
}) {
  useSyncExternalStore(orange.subscribe, orange.getVersion, orange.getVersion);
  useSyncExternalStore(purple.subscribe, purple.getVersion, purple.getVersion);
  useSyncExternalStore(teal.subscribe, teal.getVersion, teal.getVersion);

  const pick = (s: RectScene, ghost: Rect | null): Rect | undefined =>
    ghost ?? (s.get(asNodeId('a'))?.pose as Rect | undefined);
  const a = pick(orange, ghosts.orange);
  const b = pick(purple, ghosts.purple);
  const c = pick(teal, ghosts.teal);
  if (!a || !b || !c) return null;
  const m = medianPose(a, b, c);
  const greenColor = INITIAL_GREEN[0].color;
  const cx = m.x + m.width / 2;
  const cy = m.y + m.height / 2;
  const deg = (m.rotation * 180) / Math.PI;
  return (
    <div style={{ position: 'relative' }}>
      <svg width={W} height={H} className="ckd-canvas" style={{ display: 'block', pointerEvents: 'none', overflow: 'visible' }}>
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

export function RotatedResizeMathDemo() {
  const greenScene = useScene<Rect>({ items: INITIAL_GREEN });
  const orangeScene = useScene<Rect>({ items: INITIAL_ORANGE });
  const purpleScene = useScene<Rect>({ items: INITIAL_PURPLE });
  const tealScene = useScene<Rect>({ items: INITIAL_TEAL });

  // One ResizeAdapter per scene. Memoized so controllers see stable refs.
  const greenAdapter = useMemo(() => adapterForScene(greenScene), [greenScene]);
  const orangeAdapter = useMemo(() => adapterForScene(orangeScene), [orangeScene]);
  const purpleAdapter = useMemo(() => adapterForScene(purpleScene), [purpleScene]);
  const tealAdapter = useMemo(() => adapterForScene(tealScene), [tealScene]);

  // Four controllers, one per descriptor. Each runs its own resize math
  // against its own scene; the parent drives them all from a single drag.
  const greenCtl = useResize(greenAdapter, {
    geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect>,
  });
  const orangeCtl = useResize(orangeAdapter, {
    geometry: NO_PROJECTION_DESCRIPTOR,
  });
  const purpleCtl = useResize(purpleAdapter, {
    geometry: NO_CORRECTION_DESCRIPTOR,
  });
  const tealCtl = useResize(tealAdapter, {
    geometry: COUPLED_ROTATION_DESCRIPTOR,
  });

  // Drag state: which DOM element captured the pointer, plus the controllers
  // we're driving (always all four; held in a ref to keep handlers stable).
  const controllersRef = useRef<ResizeController<{ id: string }, Rect>[]>([]);
  controllersRef.current = [greenCtl, orangeCtl, purpleCtl, tealCtl];
  const draggingRef = useRef(false);
  const captureTargetRef = useRef<Element | null>(null);
  const capturePointerIdRef = useRef<number | null>(null);
  // When set, the active gesture is a body-translate (not a corner resize):
  // dx/dy from startPt apply uniformly to every scene's starting pose so all
  // four panels stay in lockstep and the "shared starting pose" invariant
  // survives a reposition.
  const moveStateRef = useRef<{
    startPt: { x: number; y: number };
    startPoses: { scene: RectScene; pose: Rect }[];
  } | null>(null);
  // Which panel started the active drag — drives ghost recoloring across
  // panels so non-active panels' ghosts take the active panel's color.
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  // Origin fixed-corner (world space) of the active gesture. All three rects
  // share the same starting pose, so a single point is correct for every
  // panel. Cleared on release so the marker only shows during a drag.
  const [originFixed, setOriginFixed] = useState<{ x: number; y: number } | null>(null);

  const COLORS: Record<PanelId, string> = {
    green: INITIAL_GREEN[0].color,
    orange: INITIAL_ORANGE[0].color,
    purple: INITIAL_PURPLE[0].color,
    teal: INITIAL_TEAL[0].color,
  };
  const ghostColorFor = (panel: PanelId): string =>
    activePanel ? COLORS[activePanel] : COLORS[panel];

  const modifiersFromEvent = (e: PointerEvent | React.PointerEvent): ModifierState => ({
    alt: e.altKey,
    shift: e.shiftKey,
    meta: e.metaKey,
    ctrl: e.ctrlKey,
  });

  // Convert a pointer event to canvas-local pixel coords. Identity view is
  // assumed (default in this demo) so world == local. The wrapper div hosts
  // the canvas as its first child; we measure against that canvas's rect so
  // a click on the LedgerCaption (also inside the wrapper) is rejected.
  const localCoords = (e: React.PointerEvent | PointerEvent, wrapper: Element): { x: number; y: number } | null => {
    const canvas = wrapper.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
    return { x, y };
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!draggingRef.current) return;
    const target = captureTargetRef.current;
    if (!target) return;
    const pt = localCoords(e, target);
    if (!pt) return;
    const moveState = moveStateRef.current;
    if (moveState) {
      const dx = pt.x - moveState.startPt.x;
      const dy = pt.y - moveState.startPt.y;
      for (const { scene, pose } of moveState.startPoses) {
        scene.setPose(asNodeId('a'), { ...pose, x: pose.x + dx, y: pose.y + dy });
      }
      return;
    }
    const mods = modifiersFromEvent(e);
    for (const c of controllersRef.current) c.move(pt.x, pt.y, mods);
  }, []);

  const releaseCapture = useCallback(() => {
    const target = captureTargetRef.current;
    const pid = capturePointerIdRef.current;
    if (target && pid !== null && (target as Element & { hasPointerCapture?: (id: number) => boolean }).hasPointerCapture?.(pid)) {
      (target as Element & { releasePointerCapture: (id: number) => void }).releasePointerCapture(pid);
    }
    captureTargetRef.current = null;
    capturePointerIdRef.current = null;
    draggingRef.current = false;
    moveStateRef.current = null;
    setActivePanel(null);
    setOriginFixed(null);
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUpRef.current!);
    window.removeEventListener('pointercancel', handlePointerCancelRef.current!);
  }, [handlePointerMove]);

  const handlePointerUp = useCallback(() => {
    if (!draggingRef.current) return;
    if (!moveStateRef.current) {
      for (const c of controllersRef.current) c.end();
    }
    releaseCapture();
  }, [releaseCapture]);

  const handlePointerCancel = useCallback(() => {
    if (!draggingRef.current) return;
    if (!moveStateRef.current) {
      for (const c of controllersRef.current) c.cancel();
    }
    releaseCapture();
  }, [releaseCapture]);

  // Refs so the cleanup inside `releaseCapture` can remove the same listener
  // identities it added (handler closures change on re-render otherwise).
  const handlePointerUpRef = useRef(handlePointerUp);
  handlePointerUpRef.current = handlePointerUp;
  const handlePointerCancelRef = useRef(handlePointerCancel);
  handlePointerCancelRef.current = handlePointerCancel;

  // Shared pointerdown handler, parameterized by which panel originated
  // the gesture. Hit-tests corner handles against the GREEN rect's pose
  // (the canonical / reference) — all three rects share the same starting
  // pose in the demo, so the same handle world-coords map to the same
  // anchor across all panels. Once a handle is hit, all three controllers
  // receive the same `start(anchor, worldX, worldY)` call, and `activePanel`
  // is set so non-active panels can recolor their ghosts to match.
  const handlePointerDown = useCallback((panel: PanelId, e: React.PointerEvent<HTMLDivElement>) => {
    const wrapper = e.currentTarget;
    const pt = localCoords(e, wrapper);
    if (!pt) return;
    const ref = greenScene.get(asNodeId('a'));
    if (!ref) return;
    const refPose = ref.pose as Rect;
    // Corner handles are computed in the rect's LOCAL frame; for a rotated
    // rect we rotate the click point INTO local frame before hit-testing.
    const cx = refPose.x + refPose.width / 2;
    const cy = refPose.y + refPose.height / 2;
    const local = rotatePoint(pt.x, pt.y, cx, cy, -refPose.rotation);
    // Capture-phase swallow: this handler runs BEFORE the canvas's React
    // pointerdown handler, so stopPropagation prevents selectTool's gestures
    // (always-wired move; marquee on empty space) from firing at all. The
    // demo is a math explainer — translate, marquee, and rotate would all
    // break the "all panels share the same starting pose" invariant.
    e.stopPropagation();
    e.preventDefault();

    const handles = cornerResizeHandles(refPose);
    let hit: { anchor: ResizeAnchor } | null = null;
    for (const h of handles) {
      if (hitCornerHandle(h, local.x, local.y, HANDLE)) {
        hit = { anchor: h.anchor };
        break;
      }
    }

    // Body-translate: only the green (canonical) panel accepts a body drag.
    // The translation is applied to every scene's starting pose so all four
    // panels stay in lockstep — preserving the "shared starting pose"
    // invariant the resize comparison depends on.
    if (!hit && panel === 'green' && pointInRotatedRect(refPose, pt.x, pt.y)) {
      draggingRef.current = true;
      captureTargetRef.current = wrapper;
      capturePointerIdRef.current = e.pointerId;
      setActivePanel('green');
      wrapper.setPointerCapture?.(e.pointerId);
      const startPoses = [
        { scene: greenScene, pose: greenScene.get(asNodeId('a'))!.pose as Rect },
        { scene: orangeScene, pose: orangeScene.get(asNodeId('a'))!.pose as Rect },
        { scene: purpleScene, pose: purpleScene.get(asNodeId('a'))!.pose as Rect },
        { scene: tealScene, pose: tealScene.get(asNodeId('a'))!.pose as Rect },
      ];
      moveStateRef.current = { startPt: pt, startPoses };
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUpRef.current);
      window.addEventListener('pointercancel', handlePointerCancelRef.current);
      return;
    }

    if (!hit) return;

    draggingRef.current = true;
    captureTargetRef.current = wrapper;
    capturePointerIdRef.current = e.pointerId;
    setActivePanel(panel);
    setOriginFixed(fixedCornerWorld(refPose, hit.anchor));
    wrapper.setPointerCapture?.(e.pointerId);
    for (const c of controllersRef.current) {
      c.start('a', hit.anchor, pt.x, pt.y);
    }
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUpRef.current);
    window.addEventListener('pointercancel', handlePointerCancelRef.current);
  }, [greenScene, orangeScene, purpleScene, tealScene, handlePointerMove]);

  return (
    <div>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Rotated resize: the math, with counterexamples</h2>
        <p>
          Resizing a rotated rect requires three coordinated steps, and a fourth
          discipline: keep the rotation property orthogonal to the resize. Each
          panel below runs the same drag against the same starting pose, but
          subverts one piece. Drag any corner handle in any panel &mdash; all four
          rects resize in lockstep, each through its own pose descriptor, so one
          input drives four diverging outputs. The &ldquo;fixed corner world&rdquo;
          ledger below each panel should stay constant in the full-math panel; it
          drifts in the counterexamples.
        </p>
        <ul>
          <li><strong>Full math (green):</strong> drag is projected into local frame, anchor math runs there, position is corrected so the diagonal corner stays pinned, and rotation is preserved unchanged.</li>
          <li><strong>No projection (orange):</strong> drag delta applied in world frame &mdash; distorts on rotation.</li>
          <li><strong>No correction (purple):</strong> projection on; position correction disabled &mdash; the perceived fixed corner drifts.</li>
          <li><strong>Coupled rotation (teal):</strong> projection + correction both run, but rotation is coupled to the AABB diagonal angle &mdash; the rect rotates as you resize, the way it would if the rotation pivot drifted with size.</li>
          <li><strong>Live overlay:</strong> all four rects stacked at 60% opacity so divergence shows up as color separation.</li>
          <li><strong>Median panel:</strong> per-component median of orange + purple + teal. Each broken descriptor differs from green in exactly one component (width/height, x/y, or rotation), so the median across the three recovers the correct pose &mdash; should track green exactly. Triple modular redundancy in action.</li>
        </ul>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Panel
          title="Full math (drag me)"
          showHandles
          scene={greenScene}
          ghostPose={greenCtl.overlay?.currentPose ?? null}
          ghostColor={ghostColorFor('green')}
          fixedOrigin={originFixed}
          fixedCurrent={greenCtl.overlay ? fixedCornerWorld(greenCtl.overlay.currentPose, greenCtl.overlay.anchor) : null}
          onPointerDown={(e) => handlePointerDown('green', e)}
        />
        <Panel
          title="No projection — world-frame delta"
          showHandles={false}
          scene={orangeScene}
          ghostPose={orangeCtl.overlay?.currentPose ?? null}
          ghostColor={ghostColorFor('orange')}
          fixedOrigin={originFixed}
          fixedCurrent={orangeCtl.overlay ? fixedCornerWorld(orangeCtl.overlay.currentPose, orangeCtl.overlay.anchor) : null}
          onPointerDown={(e) => handlePointerDown('orange', e)}
        />
        <Panel
          title="No correction — anchor drifts"
          showHandles={false}
          scene={purpleScene}
          ghostPose={purpleCtl.overlay?.currentPose ?? null}
          ghostColor={ghostColorFor('purple')}
          fixedOrigin={originFixed}
          fixedCurrent={purpleCtl.overlay ? fixedCornerWorld(purpleCtl.overlay.currentPose, purpleCtl.overlay.anchor) : null}
          onPointerDown={(e) => handlePointerDown('purple', e)}
        />
        <Panel
          title="Coupled rotation — pivot follows size"
          showHandles={false}
          scene={tealScene}
          ghostPose={tealCtl.overlay?.currentPose ?? null}
          ghostColor={ghostColorFor('teal')}
          fixedOrigin={originFixed}
          fixedCurrent={tealCtl.overlay ? fixedCornerWorld(tealCtl.overlay.currentPose, tealCtl.overlay.anchor) : null}
          onPointerDown={(e) => handlePointerDown('teal', e)}
        />
        <StackedOverlayPanel
          green={greenScene} orange={orangeScene} purple={purpleScene} teal={tealScene}
          ghosts={{
            green: greenCtl.overlay?.currentPose ?? null,
            orange: orangeCtl.overlay?.currentPose ?? null,
            purple: purpleCtl.overlay?.currentPose ?? null,
            teal: tealCtl.overlay?.currentPose ?? null,
          }}
        />
        <MedianPanel
          orange={orangeScene} purple={purpleScene} teal={tealScene}
          ghosts={{
            orange: orangeCtl.overlay?.currentPose ?? null,
            purple: purpleCtl.overlay?.currentPose ?? null,
            teal: tealCtl.overlay?.currentPose ?? null,
          }}
        />
      </div>
    </div>
  );
}
