import { useMemo, useState } from 'react';
import {
  asNodeId,
  PathBuilder,
  pathPoseDescriptor,
  PATH_C,
  SceneCanvas,
  countPathAnchors,
  selectFromMarquee,
  useScene,
  useSelection,
} from '@orochi235/weasel';
import type {
  Path,
  PolygonPath,
  PoseProjection,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

const W = 720, H = 360, HANDLE = 8;
const ID = 'curve';

// An open S-curve: two cubic segments back to back.
const INITIAL_PATH: Path = new PathBuilder()
  .moveTo(60, 220)
  .curveTo(140, 60, 220, 60, 260, 160)
  .curveTo(300, 260, 380, 260, 420, 100)
  .build();

const ZOOM_LEVELS = [0.5, 0.75, 1, 1.5, 2, 3];

function rainbowColors(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = (i * 360) / Math.max(1, n);
    const [r, g, b] = hslToRgb(h, 0.8, 0.6);
    out.push(r, g, b, 1);
  }
  return out;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = l - c / 2;
  return [r + m, g + m, b + m];
}

export function BezierEditDemo() {
  // Pose/data split (a): the Path itself is the pose; data is a degenerate
  // tag. The demo's `Path` already encodes both shape and position, so a
  // separate `{x,y,w,h}` pose would just duplicate work.
  const scene = useScene<{ kind: 'path' }, 'default', Path>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      kind: 'leaf',
      layer: 'default',
      pose: INITIAL_PATH,
      data: { kind: 'path' },
      id: asNodeId(ID),
    }],
  });
  const selection = useSelection({ initial: [asNodeId(ID)] });

  const [zoom, setZoom] = useState(1);
  // Viewport scale instead of CSS transform: SceneCanvas's `view` prop
  // controls world→screen scale, and world coords flow through `clientToWorld`
  // automatically. Trades the CSS-pixel-perfect blowup for honest viewport
  // zoom (handles + line widths in screen pixels stay constant).
  const view = useMemo(
    () => ({ x: 0, y: 0, scale: { x: zoom, y: zoom } }),
    [zoom],
  );

  // pointInPath only fills closed regions, so an S-curve has no body to hit.
  // Approximate stroke-hit: AABB containment with an 8-px slop.
  const pickEvery = (wx: number, wy: number): string | null => {
    const node = scene.get(asNodeId(ID));
    if (!node) return null;
    const b = pathPoseDescriptor.getBounds(node.pose);
    const slop = 8;
    const inside = wx >= b.x - slop && wx <= b.x + b.width + slop
      && wy >= b.y - slop && wy <= b.y + b.height + slop;
    return inside ? ID : null;
  };

  const appendCurve = () => {
    const node = scene.get(asNodeId(ID));
    if (!node) return;
    const p = node.pose;
    if (p.kind !== 'polygon') return;
    // Every command (M/L/C/Q) ends on (x,y), so the trailing pair of coords
    // is the current end of the path. Append a cubic ~80px to the right.
    const cs = p.coords;
    const ex = cs[cs.length - 2];
    const ey = cs[cs.length - 1];
    const nx = ex + 80;
    const ny = ey + (Math.random() < 0.5 ? -40 : 40);
    const c1x = ex + 30, c1y = ey - 30;
    const c2x = nx - 30, c2y = ny - 30;
    const nextCmds = new Uint8Array(p.commands.length + 1);
    nextCmds.set(p.commands);
    nextCmds[p.commands.length] = PATH_C;
    const nextCoords = new Float32Array(cs.length + 6);
    nextCoords.set(cs);
    nextCoords.set([c1x, c1y, c2x, c2y, nx, ny], cs.length);
    const next: PolygonPath = { kind: 'polygon', commands: nextCmds, coords: nextCoords, fillRule: p.fillRule };
    scene.setPose(asNodeId(ID), next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={appendCurve} style={btn}>Add point</button>
        <span style={{ width: 12 }} />
        {ZOOM_LEVELS.map((z) => (
          <button
            key={z}
            onClick={() => setZoom(z)}
            style={{
              ...btn,
              background: zoom === z ? '#7fb069' : '#2a2018',
              color: zoom === z ? '#1a130d' : '#d4c4a8',
            }}
          >{z}×</button>
        ))}
      </div>
      <SceneCanvas
        width={W * zoom}
        height={H * zoom}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        view={view}
        geometry={{ pickEvery }}
        selectTool={{
          handleHitRadius: HANDLE,
          resize: { geometry: pathPoseDescriptor as PoseProjection<Path> },
          areaSelect: { behaviors: [selectFromMarquee()] },
        }}
        layers={{
          scene: {
            drawOne: (_o, p): DrawCommand[] => {
              const colors = rainbowColors(countPathAnchors(p));
              return [{
                kind: 'path',
                path: p,
                stroke: { paint: { color: '#ffffff' }, width: 2, vertexColors: colors },
              }];
            },
          },
          selectionOverlay: { handles: { size: HANDLE } },
        }}
      />
    </div>
  );
}

const btn: React.CSSProperties = {
  padding: '4px 10px', fontSize: 12, cursor: 'pointer',
  background: '#2a2018', color: '#d4c4a8',
  border: '1px solid #4a3c2e', borderRadius: 3,
};
