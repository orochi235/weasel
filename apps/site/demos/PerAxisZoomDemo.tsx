import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  fitViewToBounds,
} from '@weasel-js/core';
import type { DrawCommand } from '../../../src/renderer';
import type { View } from '../../../src/core/viewport/view';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;
// Non-square bounds so 'contain' / 'fill' / 'stretch' look visibly different.
const IMAGE_BOUNDS = { x: 0, y: 0, width: 400, height: 200 };

export function PerAxisZoomDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'image' as never, kind: 'leaf', layer: 'default',
        pose: { x: 0, y: 0, width: 400, height: 200 },
        data: { color: '#7fb069' } },
    ],
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: -100, y: -100, scale: { x: 1, y: 1 } });
  const [mode, setMode] = useState<'contain' | 'fill' | 'stretch'>('contain');

  const setScaleX = (sx: number) => setView({ ...view, scale: { ...view.scale, x: sx } });
  const setScaleY = (sy: number) => setView({ ...view, scale: { ...view.scale, y: sy } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontFamily: 'monospace' }}>
          scale.x:{' '}
          <input
            type="range" min={0.25} max={4} step={0.05}
            value={view.scale.x}
            onChange={(e) => setScaleX(parseFloat(e.target.value))}
          />{' '}
          {view.scale.x.toFixed(2)}
        </label>
        <label style={{ fontFamily: 'monospace' }}>
          scale.y:{' '}
          <input
            type="range" min={0.25} max={4} step={0.05}
            value={view.scale.y}
            onChange={(e) => setScaleY(parseFloat(e.target.value))}
          />{' '}
          {view.scale.y.toFixed(2)}
        </label>
        <label>
          mode:{' '}
          <select value={mode} onChange={(e) => setMode(e.target.value as typeof mode)}>
            <option value="contain">contain</option>
            <option value="fill">fill</option>
            <option value="stretch">stretch</option>
          </select>
        </label>
        <button onClick={() => setView(fitViewToBounds(IMAGE_BOUNDS, { width: W, height: H }, view, { mode }))}>
          Fit
        </button>
        <button onClick={() => setView({ x: -100, y: -100, scale: { x: 1, y: 1 } })}>
          Reset
        </button>
      </div>
      <span style={{ fontSize: 12, color: '#888' }}>
        Cmd/Ctrl+wheel zooms uniformly · plain wheel pans · Cmd/Ctrl+= / - / 0 for zoom steps.
      </span>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        view={view}
        onViewChange={setView}
        viewport={{}}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: n.data.color },
              stroke: { paint: { color: '#d4c4a8' }, width: 2 },
            }],
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
