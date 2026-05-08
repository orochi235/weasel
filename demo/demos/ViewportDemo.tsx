import { useState } from 'react';
import { SceneCanvas, useScene } from '@orochi235/weasel';

type Layer = 'scene';
interface Data { color: string; label: string }
interface Pose { x: number; y: number; width: number; height: number }

const NODES: Array<{ id: string; pose: Pose; data: Data }> = [
  { id: 'a', pose: { x:  40, y:  40, width: 100, height: 70 }, data: { color: '#7fb069', label: 'A' } },
  { id: 'b', pose: { x: 220, y:  80, width: 100, height: 70 }, data: { color: '#a48bd4', label: 'B' } },
  { id: 'c', pose: { x: 420, y:  30, width: 100, height: 70 }, data: { color: '#e8a87c', label: 'C' } },
  { id: 'd', pose: { x:  80, y: 220, width: 100, height: 70 }, data: { color: '#5ba3c9', label: 'D' } },
  { id: 'e', pose: { x: 320, y: 260, width: 100, height: 70 }, data: { color: '#d4c4a8', label: 'E' } },
  { id: 'f', pose: { x: 560, y: 200, width: 100, height: 70 }, data: { color: '#e07b7b', label: 'F' } },
  { id: 'g', pose: { x: 160, y: 380, width: 100, height: 70 }, data: { color: '#f0d080', label: 'G' } },
  { id: 'h', pose: { x: 480, y: 380, width: 100, height: 70 }, data: { color: '#7fb069', label: 'H' } },
];

export const VIEWPORT_DEMO_SOURCE = `<SceneCanvas
  scene={scene}
  viewport={{
    inertia: { friction: 0.88 },
    pinchZoom: true,
    animatedZoom: true,
  }}
  layers={{ scene: { drawOne } }}
/>`;

type Boundary = 'none' | 'stop' | 'bounce';

export function ViewportDemo() {
  const [boundary, setBoundary] = useState<Boundary>('none');
  const [inertiaOn, setInertiaOn] = useState(true);

  const scene = useScene<Data, Layer, Pose>({
    systemLayers: [{ id: 'scene' }],
    initial: NODES.map((n) => ({ ...n, id: n.id as never, kind: 'leaf' as const, layer: 'scene' })),
  });

  const inertiaConfig = inertiaOn
    ? {
        friction: 0.88,
        ...(boundary !== 'none' ? {
          boundary: boundary as 'stop' | 'bounce',
          bounds: { minX: -20, maxX: 300, minY: -20, maxY: 200 },
        } : {}),
      }
    : false as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
          <input type="checkbox" checked={inertiaOn} onChange={(e) => setInertiaOn(e.target.checked)} />
          inertia
        </label>
        <span style={{ color: '#666' }}>boundary:</span>
        {(['none', 'stop', 'bounce'] as Boundary[]).map((b) => (
          <label key={b} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: inertiaOn ? 1 : 0.4 }}>
            <input type="radio" name="boundary" value={b} checked={boundary === b} onChange={() => setBoundary(b)} disabled={!inertiaOn} />
            {b}
          </label>
        ))}
        <span style={{ color: '#888', fontSize: 12 }}>
          {boundary !== 'none' && inertiaOn ? '(bounds: x 0–300, y 0–200)' : ''}
        </span>
      </div>
      <SceneCanvas
        scene={scene}
        width={480}
        height={320}
        background="#1a130d"
        viewport={{
          inertia: inertiaConfig,
          pinchZoom: true,
          animatedZoom: true,
        }}
        layers={{
          scene: {
            drawOne: (ctx, node, pose, view) => {
              const p = pose as Pose;
              ctx.fillStyle = node.data.color;
              ctx.fillRect(p.x, p.y, p.width, p.height);
              ctx.strokeStyle = 'rgba(255,255,255,0.25)';
              ctx.lineWidth = 1.5 / view.scale;
              ctx.strokeRect(p.x, p.y, p.width, p.height);
              ctx.fillStyle = '#1a130d';
              ctx.font = `bold ${14 / view.scale}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(node.data.label, p.x + p.width / 2, p.y + p.height / 2);
            },
          },
        }}
      />
      <div style={{ fontSize: 11, color: '#888' }}>
        H / space = hand · drag fast + release = inertia · ⌘+= / ⌘+- / ⌘+0 = animated zoom · pinch = zoom (touch/trackpad)
      </div>
    </div>
  );
}
