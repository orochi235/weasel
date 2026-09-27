import { useMemo, useState } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  createViewportLayer,
  meanScale,
  viewportsAt,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { View, RenderLayer } from '@weasel-js/core';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;

const COLORS: NodeData['color'][] = ['#7fb069', '#a48bd4', '#f0e0a8', '#e07a7a', '#5fb0c2'];
export function makeRandomScene() {
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

/** PiP geometry: a 240×160 screen rect at 1.6×, lensing a 150×100 world slice. */
export const PIP = { w: 240, h: 160, scale: 1.6, margin: 8 };

/** Inner view for the PiP, centered on the first node. Aiming it at a fixed
 *  world rect instead leaves it empty on about half of this demo's randomly
 *  placed scenes, which reads as a broken viewport rather than an empty one. */
export function pipView(items: ReturnType<typeof makeRandomScene>): View {
  const p = items[0]!.pose;
  return {
    x: p.x + p.width / 2 - PIP.w / PIP.scale / 2,
    y: p.y + p.height / 2 - PIP.h / PIP.scale / 2,
    scale: { x: PIP.scale, y: PIP.scale },
  };
}

interface SourceItem { pose: Pose; data: NodeData }

/**
 * The scene's rects, emitted in **world** coordinates.
 *
 * A `space: 'world'` layer must not apply the view itself: `drawOneLayer`
 * wraps its output in `viewToMat3` of whichever view is rendering it, so a
 * layer that pre-multiplies lands its content at scale squared, off-screen.
 */
export function createSceneSourceLayer(items: () => Iterable<SourceItem>): RenderLayer<unknown> {
  return {
    id: 'viewport-source',
    label: 'Viewport source',
    space: 'world',
    draw: (): DrawCommand[] =>
      [...items()].map(({ pose, data }): DrawCommand => ({
        kind: 'path',
        path: { kind: 'rect', x: pose.x, y: pose.y, width: pose.width, height: pose.height },
        fill: { fill: 'solid', color: data.color },
      })),
  };
}

/**
 * The main canvas's visible window as a dashed world-space rect, so any
 * viewport lensing it shows where the outer camera is looking.
 *
 * Width and dash divide by the lensing view's scale - the world-space way to
 * pin a hairline to screen pixels.
 */
export function createViewIndicatorLayer(mainView: () => View): RenderLayer<unknown> {
  return {
    id: 'viewport-indicator',
    label: 'Visible area',
    space: 'world',
    draw: (_data, v): DrawCommand[] => {
      const main = mainView();
      const px = 1 / meanScale(v.scale);
      return [{
        kind: 'path',
        path: {
          kind: 'rect',
          x: main.x, y: main.y,
          width: W / main.scale.x, height: H / main.scale.y,
        },
        stroke: { paint: { fill: 'solid', color: '#ffffff' }, width: px, dash: [2 * px, 3 * px] },
      }];
    },
  };
}

export function ViewportLayerDemo() {
  const initial = useMemo(makeRandomScene, []);
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial,
  });
  const selection = useSelection();
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const [probe, setProbe] = useState('—');

  const sceneSource = useMemo(
    () =>
      createSceneSourceLayer(() =>
        [...scene.nodes.values()]
          .filter((n) => n.kind === 'leaf')
          .map((n) => ({ pose: n.pose, data: n.data }))),
    [scene],
  );
  const viewIndicator = useMemo(() => createViewIndicatorLayer(() => view), [view]);

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

  // Picture-in-picture: bottom-left, zoomed-in slice of the world.
  const pip = useMemo(
    () =>
      createViewportLayer<unknown>({
        id: 'pip',
        label: 'PiP',
        source: [sceneSource],
        view: pipView(initial),
        bounds: (_outer, dims) => ({ x: PIP.margin, y: dims.height - PIP.h - PIP.margin, w: PIP.w, h: PIP.h }),
        background: 'rgba(0,0,0,0.4)',
      }),
    [sceneSource, initial],
  );

  // Clicking inside a viewport reports where the pointer landed in that
  // viewport's inner world. The kit re-projects on request; it does not route
  // the event, so the tools below still see the outer view.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const canvas = e.currentTarget.querySelector('canvas');
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const screen = { x: e.clientX - r.left, y: e.clientY - r.top };
    const hit = viewportsAt([minimap, pip], view, { width: W, height: H }, screen);
    setProbe(hit ? `${hit.layer.label} → (${hit.point.x.toFixed(0)}, ${hit.point.y.toFixed(0)})` : 'outer canvas');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontFamily: 'monospace' }}>view: ({view.x.toFixed(0)}, {view.y.toFixed(0)}) ×{view.scale.x.toFixed(2)}</span>
        <button onClick={() => setView({ x: 0, y: 0, scale: { x: 1, y: 1 } })}>Reset</button>
        <span style={{ fontFamily: 'monospace', color: '#888' }}>click: {probe}</span>
      </div>
      <div onPointerDown={onPointerDown}>
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
    </div>
  );
}
