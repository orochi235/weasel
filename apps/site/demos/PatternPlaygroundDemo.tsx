import { useMemo } from 'react';
import { SceneCanvas, useScene } from '@weasel-js/core';
import type { FillStyle, RenderLayer } from '@weasel-js/core';
import { hatch, crosshatch, dots, chunks } from '@weasel-js/core/patterns-builtin';
import { viewToMat3, type DrawCommand } from '@weasel-js/core/renderer';

const W = 600;
const H = 400;

const CELL = { w: 260, h: 160 };
const GAP = 20;

export function PatternPlaygroundDemo() {
  const tiles = useMemo(() => [
    { label: 'hatch', handle: hatch({ color: '#0fb5a8' }) },
    { label: 'crosshatch', handle: crosshatch({ color: '#c84edb' }) },
    { label: 'dots', handle: dots({ color: '#f4c43c', size: 8, radius: 2 }) },
    { label: 'chunks', handle: chunks({ color: '#e2574c', bg: '#1d2733' }) },
  ], []);

  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: 'pattern-swatches',
    label: 'Pattern swatches',
    draw: (_data, v): DrawCommand[] => [{
      kind: 'group',
      transform: viewToMat3(v),
      children: tiles.flatMap((t, i) => {
        if (!t.handle) return [];
        const rect = {
          x: GAP + (i % 2) * (CELL.w + GAP),
          y: GAP + Math.floor(i / 2) * (CELL.h + GAP),
          width: CELL.w,
          height: CELL.h,
        };
        const fill: FillStyle = { fill: 'pattern', pattern: t.handle };
        return [{ kind: 'path', path: { kind: 'rect', ...rect }, fill } as DrawCommand];
      }),
    }],
  }), [tiles]);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div className="ckd-stack">
      <div className="ckd-canvas-frame">
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            patterns: { layer, after: 'scene' },
          }}
        />
      </div>
    </div>
  );
}
