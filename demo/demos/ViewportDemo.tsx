import { useState } from 'react';
import { SceneCanvas, useScene, textCommand, meanScale } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

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
            drawOne: (node, pose, view): DrawCommand[] => {
              const p = pose as Pose;
              const fontSize = 14 / meanScale(view.scale);
              const label = node.data.label;
              const charW = fontSize * 0.6;
              return [
                {
                  kind: 'path',
                  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                  fill: { color: node.data.color },
                },
                {
                  kind: 'path',
                  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                  stroke: { paint: { color: 'rgba(255,255,255,0.25)' }, width: 1.5 / meanScale(view.scale) },
                },
                // Center-aligned: x = center - (text_width / 2). Approximates
                // ctx.textAlign='center' since TextDrawCommand uses left baseline.
                textCommand(
                  p.x + p.width / 2 - (label.length * charW) / 2,
                  p.y + p.height / 2 + fontSize / 3,  // textBaseline='middle' → shift down ~1/3 emHeight
                  label,
                  { fontFamily: 'sans-serif', fontSize, fill: { fill: 'solid', color: '#1a130d' } },
                ),
              ];
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
