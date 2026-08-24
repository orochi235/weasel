import { SceneCanvas, asNodeId, useScene } from '@weasel-js/core';
import type { FillStyle, TilePatternSpec } from '@weasel-js/core';

const W = 600;
const H = 400;

const CELL = { w: 260, h: 160 };
const GAP = 20;

const TILES: TilePatternSpec[] = [
  { tile: 'hatch', color: '#0fb5a8' },
  { tile: 'crosshatch', color: '#c84edb' },
  { tile: 'dots', color: '#f4c43c', size: 8, radius: 2 },
  { tile: 'chunks', color: '#e2574c', bg: '#1d2733' },
];

interface PatternRect {
  shape: 'rect';
  fill: FillStyle;
}

export function PatternPlaygroundDemo() {
  const scene = useScene<PatternRect, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: TILES.map((tile, i) => ({
      kind: 'leaf',
      layer: 'default',
      id: asNodeId(tile.tile),
      pose: {
        x: GAP + (i % 2) * (CELL.w + GAP),
        y: GAP + Math.floor(i / 2) * (CELL.h + GAP),
        width: CELL.w,
        height: CELL.h,
      },
      data: { shape: 'rect', fill: { fill: 'pattern', pattern: tile } },
    })),
  });

  return (
    <div className="ckd-stack">
      <div className="ckd-canvas-frame">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          selectionMode="none"
        />
      </div>
    </div>
  );
}
