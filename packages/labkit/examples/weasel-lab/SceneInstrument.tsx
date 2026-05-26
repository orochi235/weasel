import {
  SceneCanvas,
  WeaselProvider,
  gridSnapStrategy,
  useScene,
  useSelection,
} from '@orochi235/weasel';
import type { UnitSystem } from '@orochi235/weasel';
import { useEffect, useMemo, useRef, useState } from 'react';
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

const INITIAL_NODES = [
  {
    id: 'a' as never,
    kind: 'leaf' as const,
    layer: 'default' as const,
    pose: { x: 40, y: 40, width: 80, height: 60 },
    data: { color: '#7fb069' },
  },
  {
    id: 'b' as never,
    kind: 'leaf' as const,
    layer: 'default' as const,
    pose: { x: 180, y: 120, width: 100, height: 80 },
    data: { color: '#d4a574' },
  },
  {
    id: 'c' as never,
    kind: 'leaf' as const,
    layer: 'default' as const,
    pose: { x: 340, y: 60, width: 70, height: 70 },
    data: { color: '#a48bd4' },
  },
];

const SYSTEM_LAYERS = [{ id: 'default' as const }];

function SceneBody({ config }: { config: SceneConfig }) {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: SYSTEM_LAYERS,
    initial: INITIAL_NODES,
  });
  const selection = useSelection();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const box = entry.contentBoxSize?.[0];
      const w = Math.round(box ? box.inlineSize : entry.contentRect.width);
      const h = Math.round(box ? box.blockSize : entry.contentRect.height);
      if (w <= 0 || h <= 0) return;
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const selectTool = useMemo(
    () => ({ snap: gridSnapStrategy<Pose>({ value: config.cellSize, unit: 'px' }, UNITS) }),
    [config.cellSize],
  );

  const layers = useMemo(
    () => ({
      grid: config.showGrid
        ? {
            spacing: { value: config.cellSize, unit: 'px' as const },
            unitSystem: UNITS,
            bounds: () => ({ x: 0, y: 0, width: 2000, height: 2000 }),
            accentEvery: 5,
          }
        : null,
      scene: {
        drawOne: (n: { data: NodeData }, p: Pose) => [
          {
            kind: 'path' as const,
            path: { kind: 'rect' as const, x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: n.data.color },
          },
        ],
      },
      selectionOverlay: { handles: true },
    }),
    [config.showGrid, config.cellSize],
  );

  return (
    <div
      ref={containerRef}
      className="lk-weasel-host"
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <SceneCanvas
          width={size.w}
          height={size.h}
          scene={scene}
          selection={selection}
          selectTool={selectTool}
          layers={layers}
        />
      </div>
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
      <SceneBody config={(ctx as RenderContext<unknown, SceneConfig>).config} />
    </WeaselProvider>
  ),
});
