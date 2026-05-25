import {
  SceneCanvas,
  WeaselProvider,
  gridSnapStrategy,
  useScene,
  useSelection,
} from '@orochi235/weasel';
import type { UnitSystem } from '@orochi235/weasel';
import { useEffect, useRef, useState } from 'react';
import { defineInstrument, type RenderContext } from '@labkit/react';

interface NodeData {
  color: string;
}
interface Pose {
  x: number;
  y: number;
  width: number;
  height: number;
}
type LayerId = 'default';

interface SceneConfig {
  cellSize: number;
  showGrid: boolean;
}

const UNITS: UnitSystem = { base: 'px', units: { px: 1 } };

function SceneBody({ ctx }: { ctx: RenderContext<unknown, SceneConfig> }) {
  const config = ctx.config;
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      {
        id: 'a' as never,
        kind: 'leaf',
        layer: 'default',
        pose: { x: 40, y: 40, width: 80, height: 60 },
        data: { color: '#7fb069' },
      },
      {
        id: 'b' as never,
        kind: 'leaf',
        layer: 'default',
        pose: { x: 180, y: 120, width: 100, height: 80 },
        data: { color: '#d4a574' },
      },
      {
        id: 'c' as never,
        kind: 'leaf',
        layer: 'default',
        pose: { x: 340, y: 60, width: 70, height: 70 },
        data: { color: '#a48bd4' },
      },
    ],
  });
  const selection = useSelection();
  const [view, setView] = useState({ x: 0, y: 0, scale: { x: 1, y: 1 } });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setSize({ w: Math.round(r.width), h: Math.round(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      <SceneCanvas
        width={size.w}
        height={size.h}
        scene={scene}
        selection={selection}
        selectTool={{
          snap: gridSnapStrategy<Pose>({ value: config.cellSize, unit: 'px' }, UNITS),
        }}
        view={view}
        onViewChange={setView}
        viewport={{}}
        layers={{
          grid: config.showGrid
            ? {
                spacing: { value: config.cellSize, unit: 'px' },
                unitSystem: UNITS,
                bounds: () => ({ x: 0, y: 0, width: 2000, height: 2000 }),
                accentEvery: 5,
              }
            : null,
          scene: {
            drawOne: (n, p) => [
              {
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { color: n.data.color },
              },
            ],
          },
          selectionOverlay: { handles: true },
        }}
      />
    </div>
  );
}

export const SceneInstrument = defineInstrument<Record<string, never>, SceneConfig>({
  name: 'WeaselScene',
  defaultConfig: () => ({ cellSize: 20, showGrid: true }),
  initialState: () => ({}),
  configSchema: () => [
    { type: 'checkbox', key: 'showGrid', label: 'Show grid', default: true },
    {
      type: 'slider',
      key: 'cellSize',
      label: 'Grid spacing',
      min: 5,
      max: 80,
      step: 5,
      default: 20,
    },
  ],
  render: (ctx) => (
    <WeaselProvider>
      <SceneBody ctx={ctx as RenderContext<unknown, SceneConfig>} />
    </WeaselProvider>
  ),
});
