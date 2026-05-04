import { useState } from 'react';
import {
  SceneCanvas,
  composePath,
  pathPoseDescriptor,
  PathBuilder,
  polygonFromPoints,
  traceToContext,
  useScene,
  asNodeId,
} from '@orochi235/weasel';
import type { Path } from '@orochi235/weasel';

interface Shape { id: string; pose: Path; fill: string; stroke?: string; label?: string }
interface ShapeData { fill: string; stroke?: string; label?: string }

const W = 720, H = 480, HANDLE = 8;

function ghost(): Path {
  const b = new PathBuilder().setFillRule('evenodd');
  // Body outline: rounded dome with wavy bottom (Q segments for curls).
  b.moveTo(60, 110);
  b.quadTo(60, 40, 140, 40);
  b.quadTo(220, 40, 220, 110);
  b.lineTo(220, 200);
  b.quadTo(205, 230, 190, 200);
  b.quadTo(175, 170, 160, 200);
  b.quadTo(145, 230, 130, 200);
  b.quadTo(115, 170, 100, 200);
  b.quadTo(85, 230, 70, 200);
  b.quadTo(60, 180, 60, 160);
  b.close();
  // Eye holes — inner subpaths, evenodd punches them out.
  b.moveTo(105, 110); b.lineTo(120, 110); b.lineTo(120, 135); b.lineTo(105, 135); b.close();
  b.moveTo(160, 110); b.lineTo(175, 110); b.lineTo(175, 135); b.lineTo(160, 135); b.close();
  return b.build();
}

function duck(): Path {
  // Body is the "parent" frame; head/beak/eye are authored in the body's
  // local space (origin at body's top-left) and lifted via composePath. Eye
  // is a small inner subpath rather than a separate shape so the duck stays
  // one selectable/draggable unit.
  const body = polygonFromPoints([
    { x: 20, y: 60 }, { x: 0, y: 95 }, { x: 30, y: 130 },
    { x: 130, y: 130 }, { x: 160, y: 100 }, { x: 150, y: 70 },
    { x: 90, y: 60 },
  ]);
  // Head/beak/eye in body's local frame (origin at body AABB top-left = (0, 60)).
  const headLocal = polygonFromPoints([
    { x: 70, y: -50 }, { x: 110, y: -55 }, { x: 130, y: -30 },
    { x: 125, y: 0 }, { x: 90, y: 5 }, { x: 70, y: -20 },
  ]);
  const beakLocal = polygonFromPoints([
    { x: 130, y: -35 }, { x: 165, y: -30 }, { x: 165, y: -18 }, { x: 130, y: -22 },
  ]);
  const eyeLocal = polygonFromPoints([
    { x: 95, y: -35 }, { x: 102, y: -35 }, { x: 102, y: -28 }, { x: 95, y: -28 },
  ]);
  return composeMany([body, composePath(body, headLocal), composePath(body, beakLocal), composePath(body, eyeLocal)]);
}

function composeMany(parts: Path[]): Path {
  const b = new PathBuilder();
  for (const p of parts) {
    if (p.kind !== 'polygon') continue;
    const { commands, coords } = p;
    let ci = 0;
    for (let i = 0; i < commands.length; i++) {
      const c = commands[i];
      if (c === 0) { b.moveTo(coords[ci], coords[ci + 1]); ci += 2; }
      else if (c === 1) { b.lineTo(coords[ci], coords[ci + 1]); ci += 2; }
      else if (c === 2) { b.curveTo(coords[ci], coords[ci + 1], coords[ci + 2], coords[ci + 3], coords[ci + 4], coords[ci + 5]); ci += 6; }
      else if (c === 3) { b.quadTo(coords[ci], coords[ci + 1], coords[ci + 2], coords[ci + 3]); ci += 4; }
      else if (c === 4) { b.close(); }
    }
  }
  return b.build();
}

function hamburglar(): Path {
  // Disjoint subpaths under one pose: hat + cape, no touching.
  const b = new PathBuilder();
  // Hat brim + crown.
  b.moveTo(0, 30); b.lineTo(90, 30); b.lineTo(90, 40); b.lineTo(0, 40); b.close();
  b.moveTo(20, 0); b.lineTo(70, 0); b.lineTo(70, 30); b.lineTo(20, 30); b.close();
  // Cape (separate subpath, gap above).
  b.moveTo(0, 70); b.lineTo(90, 70); b.lineTo(110, 130); b.lineTo(-20, 130); b.close();
  return b.build();
}

function goose(): Path {
  // Tall, narrow — long neck up, plump body at bottom. Single non-self-
  // intersecting outline so winding-fill matches the visual silhouette.
  return polygonFromPoints([
    { x: 35, y: 0 },   // beak top
    { x: 55, y: 5 },
    { x: 50, y: 18 },
    { x: 45, y: 30 },  // neck top right
    { x: 45, y: 180 },
    { x: 75, y: 195 },
    { x: 80, y: 230 },
    { x: 60, y: 250 },
    { x: 20, y: 250 },
    { x: 0, y: 230 },
    { x: 5, y: 195 },
    { x: 35, y: 180 }, // neck bottom left
    { x: 35, y: 30 },  // neck top left
    { x: 30, y: 18 },
    { x: 25, y: 5 },
  ]);
}

function octopus(): Path {
  const b = new PathBuilder();
  // Central body: closed blob.
  const cx = 100, cy = 100, r = 35;
  b.moveTo(cx + r, cy);
  for (let i = 1; i <= 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  b.close();
  // Eight tentacles as open polylines (no close).
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const sx = cx + Math.cos(a) * r;
    const sy = cy + Math.sin(a) * r;
    b.moveTo(sx, sy);
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      const wob = Math.sin(t * Math.PI * 2 + i) * 12;
      const ex = sx + Math.cos(a) * 70 * t + Math.cos(a + Math.PI / 2) * wob;
      const ey = sy + Math.sin(a) * 70 * t + Math.sin(a + Math.PI / 2) * wob;
      b.lineTo(ex, ey);
    }
  }
  return b.build();
}

function translate(p: Path, dx: number, dy: number): Path {
  return pathPoseDescriptor.translate!(p, dx, dy);
}

const INITIAL: Shape[] = [
  { id: 'ghost',      pose: translate(ghost(),      40,  40), fill: '#e8e8f0', stroke: '#1a130d' },
  { id: 'duck',       pose: translate(duck(),      330,  60), fill: '#f5c542', stroke: '#7a5b10' },
  { id: 'hamburglar', pose: translate(hamburglar(),540,  60), fill: '#2a2a32', stroke: '#000' },
  { id: 'goose',      pose: translate(goose(),     620, 200), fill: '#fafafa', stroke: '#1a130d' },
  { id: 'octopus',    pose: translate(octopus(),    50, 240), fill: '#c47ad4', stroke: '#5a2e6a' },
];

export function CompoundPathsDemo() {
  const scene = useScene<ShapeData, 'default', Path>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL.map((s) => ({
      kind: 'leaf',
      layer: 'default',
      pose: s.pose,
      data: { fill: s.fill, stroke: s.stroke, label: s.label },
      id: asNodeId(s.id),
    })),
  });
  const [toast, setToast] = useState<string | null>(null);

  const honkBounds = () => {
    const g = scene.get(asNodeId('goose'));
    if (!g) return null;
    const b = pathPoseDescriptor.getBounds(g.pose);
    return { x: b.x + b.width / 2 - 18, y: b.y - 22, w: 36, h: 16 };
  };

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        background="#87ceeb"
        selectionMode="multi"
        tool="none"
        handleHitRadius={HANDLE}
        layers={{
          scene: {
            drawOne: (cx, node, p) => {
              cx.fillStyle = node.data.fill;
              cx.strokeStyle = node.data.stroke ?? '#1a130d';
              cx.lineWidth = 1.5;
              traceToContext(cx, p);
              if (p.kind === 'polygon' && p.fillRule === 'evenodd') cx.fill('evenodd');
              else cx.fill();
              cx.stroke();
            },
          },
          selectionOverlay: { handles: { size: HANDLE } },
          signature: {
            layer: {
              id: 'signature',
              label: 'Signature',
              draw: (ctx) => {
                ctx.save();
                ctx.font = 'italic 14px "Comic Sans MS", "Comic Sans", cursive';
                ctx.fillStyle = '#d4c4a8';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'bottom';
                ctx.fillText('original artwork by claude', W - 10, H - 8);
                ctx.restore();
              },
            },
            after: 'selectionOverlay',
          },
        }}
      />
      <HonkButton
        getBounds={honkBounds}
        onHonk={() => {
          setToast('HONK');
          setTimeout(() => setToast(null), 900);
        }}
      />
      {toast && (
        <div
          style={{
            position: 'absolute', left: '50%', top: 12, transform: 'translateX(-50%)',
            background: '#1a130d', color: '#fafafa', padding: '4px 12px',
            borderRadius: 4, fontFamily: 'monospace', fontSize: 14, pointerEvents: 'none',
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function HonkButton({ getBounds, onHonk }: { getBounds: () => { x: number; y: number; w: number; h: number } | null; onHonk: () => void }) {
  const b = getBounds();
  if (!b) return null;
  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); onHonk(); }}
      style={{
        position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h,
        font: '11px monospace', background: '#f5c542', border: '1px solid #1a130d',
        borderRadius: 3, cursor: 'pointer', padding: 0,
      }}
    >
      honk
    </button>
  );
}

export const COMPOUND_PATHS_DEMO_SOURCE = `// Five non-rect shapes on one canvas, all editable end-to-end.
//   - Ghost: multi-contour PolygonPath with evenodd (eye holes), Q curls.
//   - Duck: composePath fuse of body/head/beak/eye PolygonPaths.
//   - Hamburglar: disjoint subpaths (cape + hat) under one pose.
//   - Goose: extreme aspect ratio (long neck) — stresses resize anchoring.
//   - Octopus: open polyline tentacles + closed body subpath.

// No explicit adapter — Canvas synthesizes one from items + setItems + toPose.
// fromPose is needed because resize writes a new Path back; intersectsRect
// teaches area-select about path geometry.
return (
  <Canvas
    items={shapes}
    setItems={setShapes}
    toPose={(s) => s.pose}
    fromPose={(s, pose) => ({ ...s, pose })}
    intersectsRect={(pose, rect) => pathPoseDescriptor.intersectsRect!(pose, rect)}
    // Path TPose is auto-detected — Canvas dispatches on pose.kind so bounds /
    // translate / resize-remap, plus pointInPath silhouette hit-testing, all
    // wire up without an explicit geometry / hitBody prop.
    selectionMode="multi"             // shift-click extend, union-AABB resize
    tool="select"                     // empty-space drag = marquee select
    layers={{
      scene: { drawOne: (cx, s, p) => { traceToContext(cx, p); cx.fill(p.kind === 'polygon' ? p.fillRule : 'nonzero'); cx.stroke(); } },
      selectionOverlay: { handles: { size: HANDLE } },
    }}
  />
);
`;
