import { useMemo, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  createViewportLayer,
} from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import type { View } from '../../src/core/viewport/view';
import type { RenderLayer } from '../../src/core/layers/render';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;

const COLORS: NodeData['color'][] = ['#7fb069', '#a48bd4', '#f0e0a8', '#e07a7a', '#5fb0c2'];
function makeRandomScene() {
  const items = [];
  for (let i = 0; i < 12; i++) {
    items.push({
      id: `n${i}` as never,
      kind: 'leaf' as const,
      layer: 'default' as LayerId,
      pose: {
        x: Math.random() * 1000 - 200,
        y: Math.random() * 800 - 100,
        width: 60 + Math.random() * 60,
        height: 60 + Math.random() * 60,
      },
      data: { color: COLORS[i % COLORS.length] },
    });
  }
  return items;
}

export function ViewportLayerDemo() {
  const initial = useMemo(makeRandomScene, []);
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial,
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  // A trivial source layer that paints the same shapes the main scene
  // shows. The viewport renders this through its own `View`. In a richer
  // setup you'd pass the kit-built scene layer here so the viewport tracks
  // edits live.
  const sceneSource = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'viewport-source',
      label: 'Viewport source',
      space: 'world',
      draw: (_data, v): DrawCommand[] => {
        const cmds: DrawCommand[] = [];
        for (const node of scene.nodes.values()) {
          if (node.kind !== 'leaf') continue;
          const pose = node.pose as Pose;
          const data = node.data as NodeData;
          const sx = (pose.x - v.x) * v.scale.x;
          const sy = (pose.y - v.y) * v.scale.y;
          cmds.push({
            kind: 'path',
            path: { kind: 'rect', x: sx, y: sy, width: pose.width * v.scale.x, height: pose.height * v.scale.y },
            fill: { fill: 'solid', color: data.color },
          });
        }
        return cmds;
      },
    }),
    [scene],
  );

  // Source layer that draws a dashed outline showing where the main
  // canvas's visible window falls in world coordinates. The minimap
  // composes this on top of `sceneSource`, so the indicator stays anchored
  // to whatever world rect the main canvas is currently looking at.
  const viewIndicator = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'viewport-indicator',
      label: 'Visible area',
      space: 'world',
      draw: (_data, v): DrawCommand[] => {
        // Visible world rect of the main canvas, in world coords.
        const worldX = view.x;
        const worldY = view.y;
        const worldW = W / view.scale.x;
        const worldH = H / view.scale.y;
        // Transform into minimap-screen coords using the minimap's view.
        const sx = (worldX - v.x) * v.scale.x;
        const sy = (worldY - v.y) * v.scale.y;
        const sw = worldW * v.scale.x;
        const sh = worldH * v.scale.y;
        return [{
          kind: 'path',
          path: { kind: 'rect', x: sx, y: sy, width: sw, height: sh },
          stroke: { paint: { fill: 'solid', color: '#ffffff' }, width: 1, dash: [2, 3] },
        }];
      },
    }),
    [view],
  );

  // Minimap: top-right corner, fixed scale that fits the world bounds.
  const minimap = useMemo(
    () =>
      createViewportLayer<unknown>({
        id: 'minimap',
        label: 'Minimap',
        source: [sceneSource, viewIndicator],
        view: { x: -100, y: -100, scale: { x: 0.18, y: 0.18 } },
        bounds: (_outer, dims) => ({ x: dims.width - 180 - 8, y: 8, w: 180, h: 120 }),
        background: 'rgba(0,0,0,0.4)',
      }),
    [sceneSource, viewIndicator],
  );

  // Picture-in-picture: bottom-left, zoomed-in slice of the world centered
  // on (400, 300).
  const pip = useMemo(
    () =>
      createViewportLayer<unknown>({
        id: 'pip',
        label: 'PiP',
        source: [sceneSource],
        view: { x: 250, y: 200, scale: { x: 1.6, y: 1.6 } },
        bounds: (_outer, dims) => ({ x: 8, y: dims.height - 160 - 8, w: 240, h: 160 }),
        background: 'rgba(0,0,0,0.4)',
      }),
    [sceneSource],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace' }}>view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) ×{view.scale.x.toFixed(2)}</span>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset</button>
        <span style={{ color: '#888' }}>H = hand · top-right is a minimap; bottom-left is a PiP</span>
      </div>
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
            }],
          },
          minimap: { layer: minimap, after: 'selectionOverlay' },
          pip: { layer: pip, after: 'selectionOverlay' },
        }}
      />
    </div>
  );
}
