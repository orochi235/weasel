import { useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  pointInRotatedRect,
  ROTATED_POSE_DESCRIPTOR,
  RECT_POSE_DESCRIPTOR,
  rotatePoint,
  useScene,
  asNodeId,
} from '@orochi235/weasel';
import type { PoseDescriptor, RotatedPose } from '@orochi235/weasel';
import type { DrawCommand } from '@orochi235/weasel-gl';

type RectScene = ReturnType<typeof useScene<Rect>>;

interface Rect extends RotatedPose {
  id: string;
  color: string;
}

const W = 320, H = 240, HANDLE = 8;

const INITIAL_GREEN: Rect[] = [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#7fb069' }];
const INITIAL_ORANGE: Rect[] = [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#d4a574' }];
const INITIAL_PURPLE: Rect[] = [{ id: 'a', x: 80, y: 70, width: 160, height: 100, rotation: Math.PI / 6, color: '#a48bd4' }];

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

// TODO(rotated-resize): add a third counterexample that demonstrates
// rotation-pivot drift (re-applying rotation around the post-resize AABB
// center each frame). Requires a custom gesture controller; defer to a
// follow-up demo iteration.

function LedgerCaption({ scene, anchor }: { scene: RectScene; anchor: { x: 'min' | 'max'; y: 'min' | 'max' } }) {
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
    <pre style={{ fontSize: 11, margin: 0, fontFamily: 'monospace' }}>
      fixed corner world: ({w.x.toFixed(1)}, {w.y.toFixed(1)})
    </pre>
  );
}

/** Panel 1 — the full math (correct). */
function FullMathPanel({ scene }: { scene: RectScene }) {
  return (
    <div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectTool={{
          handleHitRadius: HANDLE,
          resize: { geometry: ROTATED_POSE_DESCRIPTOR as PoseDescriptor<Rect> },
        }}
        geometry={{ pickEvery: pickEveryFor(scene) }}
        selectionOptions={{ initial: [asNodeId('a')] }}
        layers={{
          scene: { drawOne: drawRect },
          selectionOverlay: { handles: { size: HANDLE }, rotationHandle: true },
        }}
      />
      <LedgerCaption scene={scene} anchor={{ x: 'min', y: 'min' }} />
    </div>
  );
}

function NoProjectionPanel({ scene }: { scene: RectScene }) {
  return (
    <div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectTool={{
          handleHitRadius: HANDLE,
          resize: { geometry: NO_PROJECTION_DESCRIPTOR },
        }}
        geometry={{ pickEvery: pickEveryFor(scene) }}
        selectionOptions={{ initial: [asNodeId('a')] }}
        layers={{
          scene: { drawOne: drawRect },
          selectionOverlay: { handles: { size: HANDLE }, rotationHandle: true },
        }}
      />
      <LedgerCaption scene={scene} anchor={{ x: 'min', y: 'min' }} />
    </div>
  );
}

function NoCorrectionPanel({ scene }: { scene: RectScene }) {
  return (
    <div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selectTool={{
          handleHitRadius: HANDLE,
          resize: { geometry: NO_CORRECTION_DESCRIPTOR },
        }}
        geometry={{ pickEvery: pickEveryFor(scene) }}
        selectionOptions={{ initial: [asNodeId('a')] }}
        layers={{
          scene: { drawOne: drawRect },
          selectionOverlay: { handles: { size: HANDLE }, rotationHandle: true },
        }}
      />
      <LedgerCaption scene={scene} anchor={{ x: 'min', y: 'min' }} />
    </div>
  );
}

/** Non-interactive overlay: live mirror of all three rects, 60% opacity, so
 *  divergence between the full-math panel and the counterexamples is visible
 *  at a glance without needing to compare three canvases by eye. */
function StackedOverlayPanel({ green, orange, purple }: { green: RectScene; orange: RectScene; purple: RectScene }) {
  useSyncExternalStore(green.subscribe, green.getVersion, green.getVersion);
  useSyncExternalStore(orange.subscribe, orange.getVersion, orange.getVersion);
  useSyncExternalStore(purple.subscribe, purple.getVersion, purple.getVersion);

  const poses = [green, orange, purple]
    .map((s) => s.get(asNodeId('a'))?.pose as Rect | undefined)
    .filter((p): p is Rect => !!p);

  return (
    <div>
      <svg width={W} height={H} className="ckd-canvas" style={{ display: 'block', pointerEvents: 'none' }}>
        {poses.map((p, i) => {
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
              fillOpacity={0.6}
              transform={`rotate(${deg} ${cx} ${cy})`}
            />
          );
        })}
      </svg>
      <pre style={{ fontSize: 11, margin: 0, fontFamily: 'monospace' }}>
        live overlay (non-interactive)
      </pre>
    </div>
  );
}

export function RotatedResizeMathDemo() {
  const greenScene = useScene<Rect>({ items: INITIAL_GREEN });
  const orangeScene = useScene<Rect>({ items: INITIAL_ORANGE });
  const purpleScene = useScene<Rect>({ items: INITIAL_PURPLE });
  return (
    <div>
      <header style={{ marginBottom: 12 }}>
        <h2 style={{ marginTop: 0 }}>Rotated resize: the math, with counterexamples</h2>
        <p>
          Resizing a rotated rect requires three coordinated steps. Each panel
          below runs the same drag against the same starting pose, but skips one
          step. Drag the bottom-right corner of the green rect (full math) and
          compare its behavior to the others. The &ldquo;fixed corner world&rdquo; ledger
          below each panel should stay constant in the full-math panel; it
          drifts in the counterexamples.
        </p>
        <ul>
          <li><strong>Full math (green):</strong> drag is projected into local frame, anchor math runs there, position is corrected so the diagonal corner stays pinned.</li>
          <li><strong>No projection (orange):</strong> drag delta applied in world frame &mdash; distorts on rotation.</li>
          <li><strong>No correction (purple):</strong> projection on; position correction disabled &mdash; the perceived fixed corner drifts.</li>
          <li><strong>Live overlay:</strong> all three rects stacked at 60% opacity so divergence shows up as color separation.</li>
        </ul>
      </header>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FullMathPanel scene={greenScene} />
        <NoProjectionPanel scene={orangeScene} />
        <NoCorrectionPanel scene={purpleScene} />
        <StackedOverlayPanel green={greenScene} orange={orangeScene} purple={purpleScene} />
      </div>
    </div>
  );
}
