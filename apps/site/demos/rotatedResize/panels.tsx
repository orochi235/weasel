import { SceneCanvas, asNodeId, cornerResizeHandles, rotatePoint, type useScene } from '@weasel-js/core';
import type { ResizeAnchor } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import { createGridLayer } from '@weasel-js/guides';
import num from '@weasel-js/theme/numeric.module.css';
import { fixedCornerWorld, H, HANDLE, INITIAL_GREEN, medianPose, type Rect, W } from './math';

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

const GRID = {
  layer: createGridLayer({
    spacing: 20,
    bounds: () => ({ x: 0, y: 0, width: W, height: H }),
    accentEvery: 5,
  }),
};

function LedgerCaption({
  pose, anchor, title,
}: {
  pose: Rect;
  anchor: ResizeAnchor;
  title: string;
}) {
  const w = fixedCornerWorld(pose, anchor);
  return (
    <div className={`rrmd-caption ${num.numeric}`}>
      <div className="rrmd-caption-title">{title}</div>
      <div className="rrmd-caption-body">fixed corner: ({w.x.toFixed(1)}, {w.y.toFixed(1)})</div>
    </div>
  );
}

function OverlayLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={`rrmd-caption ${num.numeric}`}>
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
  ledgerAnchor: ResizeAnchor;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  title: string;
  showHandles: boolean;
}

export function Panel({
  scene, livePose, ghostColor, fixedOrigin, anchor, ledgerAnchor, onPointerDown, title, showHandles,
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
      {displayed && (
        <LedgerCaption pose={displayed} anchor={ledgerAnchor} title={title} />
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

export function StackedOverlayPanel({
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

export function MedianPanel({
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
      <OverlayLabel title="Median(orange, purple, teal)" subtitle="recovers size and rotation, not position" />
    </div>
  );
}

// ─── Root demo ───
