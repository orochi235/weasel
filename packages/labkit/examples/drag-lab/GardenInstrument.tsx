import { createScene, screenToWorld, solid, viewToTransform } from '@weasel-js/core';
import type { AddNodeSpec, Fill, Paint, RectPose, UnitSystem, View } from '@weasel-js/core';
import { createGridLayer } from '@weasel-js/guides';
import { useMemo, useRef } from 'react';
import {
  defineInstrument,
  type RenderContext,
  type SceneTrialState,
  TrialSceneCanvas,
  useTrialScene,
} from '@weasel-js/labkit';

type Kind = 'tree' | 'shrub' | 'flower';

interface NodeData {
  kind: Kind;
  fill: Fill;
}
type Pose = RectPose;
type LayerId = 'default';
type GardenState = SceneTrialState<NodeData, LayerId, Pose>;
interface GardenConfig {
  showGrid: boolean;
}

const UNITS: UnitSystem = { base: 'px', units: { px: 1 } };
const SYSTEM_LAYERS = [{ id: 'default' as const }];

const KIND_FILLS: Record<Kind, Paint> = {
  tree: solid('#2d6a4f'),
  shrub: solid('#74c69d'),
  flower: solid('#e07a5f'),
};
const KIND_SIZE: Record<Kind, number> = { tree: 44, shrub: 28, flower: 16 };
const KIND_LABEL: Record<Kind, string> = {
  tree: '🌳 Tree',
  shrub: '🌿 Shrub',
  flower: '🌸 Flower',
};
const KINDS: Kind[] = ['tree', 'shrub', 'flower'];

const DEFAULT_VIEW: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

export const INITIAL_NODES: readonly AddNodeSpec<NodeData, LayerId, Pose>[] = [
  {
    kind: 'mark',
    layer: 'default',
    pose: { x: 180, y: 140, width: KIND_SIZE.tree, height: KIND_SIZE.tree },
    data: { kind: 'tree', fill: { paint: KIND_FILLS.tree } },
  },
  {
    kind: 'mark',
    layer: 'default',
    pose: { x: 280, y: 200, width: KIND_SIZE.shrub, height: KIND_SIZE.shrub },
    data: { kind: 'shrub', fill: { paint: KIND_FILLS.shrub } },
  },
  {
    kind: 'mark',
    layer: 'default',
    pose: { x: 360, y: 160, width: KIND_SIZE.flower, height: KIND_SIZE.flower },
    data: { kind: 'flower', fill: { paint: KIND_FILLS.flower } },
  },
];

const createGarden = () =>
  createScene<NodeData, LayerId, Pose>({ systemLayers: SYSTEM_LAYERS, initial: INITIAL_NODES });

const DRAG_MIME = 'application/x-garden-kind';

function GardenBody({ ctx }: { ctx: RenderContext<GardenState, GardenConfig> }) {
  const scene = useTrialScene(ctx, createGarden);
  const { config } = ctx;
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<View>(DEFAULT_VIEW);

  const layers = useMemo(
    () => ({
      grid: config.showGrid
        ? {
            layer: createGridLayer({
              spacing: { value: 20, unit: 'px' },
              unitSystem: UNITS,
              bounds: () => ({ x: 0, y: 0, width: 2000, height: 2000 }),
              accentEvery: 5,
            }),
          }
        : null,
    }),
    [config.showGrid],
  );

  const handlePaletteDragStart = (kind: Kind) => (e: React.DragEvent<HTMLButtonElement>) => {
    e.dataTransfer.setData(DRAG_MIME, kind);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleCanvasDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const kind = e.dataTransfer.getData(DRAG_MIME) as Kind;
    if (!kind || !KIND_SIZE[kind]) return;
    e.preventDefault();
    const host = canvasHostRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const sx = e.clientX - r.left;
    const sy = e.clientY - r.top;
    const [wx, wy] = screenToWorld(sx, sy, viewToTransform(viewRef.current));
    const s = KIND_SIZE[kind];
    scene.add({
      kind: 'mark',
      layer: 'default',
      pose: { x: wx - s / 2, y: wy - s / 2, width: s, height: s },
      data: { kind, fill: { paint: KIND_FILLS[kind] } },
    });
  };

  return (
    <div className="lk-garden-layout">
      <div
        ref={canvasHostRef}
        className="lk-garden-canvas"
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <div className="lk-garden-canvas__inner">
          <TrialSceneCanvas
            features={['view', 'pick', 'move', 'transform']}
            scene={scene}
            trial={ctx.trial}
            defaultView={DEFAULT_VIEW}
            onViewChange={(v) => {
              viewRef.current = v;
            }}
            layers={layers}
          />
        </div>
      </div>
      <div className="lk-garden-palette">
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            draggable
            onDragStart={handlePaletteDragStart(kind)}
            className="lk-garden-palette__item"
          >
            {KIND_LABEL[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}

export const GardenInstrument = defineInstrument<GardenState, GardenConfig>({
  name: 'Garden',
  defaultConfig: () => ({ showGrid: true }),
  initialState: () => ({ scene: null }),
  // Kept on the legacy defaultConfig + configSchema path on purpose, so both
  // ways of declaring config keep live coverage. SceneInstrument shows the
  // builder.
  configSchema: () => [
    { type: 'checkbox', key: 'showGrid', label: 'Show grid', default: true },
  ],
  undo: {},
  render: (ctx) => <GardenBody ctx={ctx} />,
});
