import { defineInstrument } from '@labkit/react';

interface Plant {
  id: string;
  kind: 'tree' | 'shrub' | 'flower';
  x: number;
  y: number;
}

interface GardenState {
  plants: Plant[];
}

interface GardenConfig {
  showGrid: boolean;
}

const KIND_COLORS: Record<Plant['kind'], string> = {
  tree: '#2d6a4f',
  shrub: '#74c69d',
  flower: '#e07a5f',
};

const KIND_RADIUS: Record<Plant['kind'], number> = {
  tree: 22,
  shrub: 14,
  flower: 8,
};

export const GardenInstrument = defineInstrument<GardenState, GardenConfig>({
  name: 'Garden',
  defaultConfig: () => ({ showGrid: true }),
  initialState: () => ({ plants: [] }),
  configSchema: () => [
    { type: 'checkbox', key: 'showGrid', label: 'Show grid', default: true },
  ],
  render: () => null,
  canvas: {
    initialView: { zoom: 1, pan: { x: 200, y: 150 } },
    layers: [
      {
        id: 'grid',
        draw: (ctx, { config, zoom }) => {
          if (!(config as GardenConfig).showGrid) return;
          const step = 40 * zoom;
          ctx.strokeStyle = '#e6e6e6';
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = 0; x < 2000; x += step) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 2000);
          }
          for (let y = 0; y < 2000; y += step) {
            ctx.moveTo(0, y);
            ctx.lineTo(2000, y);
          }
          ctx.stroke();
        },
      },
      {
        id: 'plants',
        draw: (ctx, { state, zoom }) => {
          for (const plant of (state as GardenState).plants) {
            ctx.fillStyle = KIND_COLORS[plant.kind];
            ctx.beginPath();
            ctx.arc(
              plant.x * zoom + 200,
              plant.y * zoom + 150,
              KIND_RADIUS[plant.kind] * zoom,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        },
      },
    ],
  },
  layers: { ids: ['grid', 'plants'] },
  dragDrop: {
    palette: [
      { id: 'tree', label: '🌳 Tree' },
      { id: 'shrub', label: '🌿 Shrub' },
      { id: 'flower', label: '🌸 Flower' },
    ],
    onDragOver: () => ({ ok: true }),
    onDrop: (worldPos, item, state) => ({
      plants: [
        ...(state as GardenState).plants,
        {
          id: `${item.id}-${Date.now()}`,
          kind: item.id as Plant['kind'],
          x: worldPos.x - 200,
          y: worldPos.y - 150,
        },
      ],
    }),
  },
  undo: { snapshotOn: ['canvas.itemAdded'], maxDepth: 50 },
});
