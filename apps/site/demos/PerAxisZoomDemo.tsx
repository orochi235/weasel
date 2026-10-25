import { useState } from 'react';
import {
  SceneCanvas,
  useScene,
  fitViewToBounds,
} from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import type { View } from '@weasel-js/core';
import { InlineRange } from '@weasel-js/ui/components/InlineRange';
import { Button } from '@weasel-js/ui/components/Button';
import { Select } from '@weasel-js/ui/components/Select';
import s from './PerAxisZoomDemo.module.css';
import { DemoStage } from './DemoStage';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 600, H = 400;
// Non-square bounds so 'contain' / 'fill' / 'stretch' look visibly different.
const IMAGE_BOUNDS = { x: 0, y: 0, width: 400, height: 200 };
type FitMode = 'contain' | 'fill' | 'stretch';
const FIT_MODES: FitMode[] = ['contain', 'fill', 'stretch'];

export function PerAxisZoomDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'image' as never, kind: 'mark', layer: 'default',
        pose: { x: 0, y: 0, width: 400, height: 200 },
        data: { color: '#7fb069' } },
    ],
  });
  const [view, setView] = useState<View>({ x: -100, y: -100, scale: { x: 1, y: 1 } });
  const [mode, setMode] = useState<FitMode>('contain');
  const [size, setSize] = useState({ width: W, height: H });

  const setScaleX = (sx: number) => setView({ ...view, scale: { ...view.scale, x: sx } });
  const setScaleY = (sy: number) => setView({ ...view, scale: { ...view.scale, y: sy } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className={s.axis}>
          scale.x:{' '}
          <InlineRange
            min={0.25} max={4} step={0.05}
            value={view.scale.x}
            onChange={(e) => setScaleX(parseFloat(e.target.value))}
          />{' '}
          {view.scale.x.toFixed(2)}
        </label>
        <label className={s.axis}>
          scale.y:{' '}
          <InlineRange
            min={0.25} max={4} step={0.05}
            value={view.scale.y}
            onChange={(e) => setScaleY(parseFloat(e.target.value))}
          />{' '}
          {view.scale.y.toFixed(2)}
        </label>
        <Select
          label="mode"
          orientation="row"
          width="fit"
          options={FIT_MODES.map((m) => ({ value: m, label: m }))}
          selectedKey={mode}
          onSelectionChange={setMode}
        />
        <Button onClick={() => setView(fitViewToBounds(IMAGE_BOUNDS, size, view, { mode }))}>Fit</Button>
        <Button onClick={() => setView({ x: -100, y: -100, scale: { x: 1, y: 1 } })}>Reset</Button>
      </div>
      <span style={{ fontSize: 12, color: '#888' }}>
        Cmd/Ctrl+wheel zooms uniformly · plain wheel pans · Cmd/Ctrl+= / - / 0 for zoom steps.
      </span>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          features={['view']}
          className="ckd-canvas"
          scene={scene}
          view={view}
          onViewChange={setView}
          onResize={setSize}
          layers={{
            scene: {
              drawOne: (n, p): DrawCommand[] => [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { paint: { color: n.data.color } },
                stroke: { paint: { color: '#d4c4a8' }, width: 2 },
              }],
            },
          }}
        />
      </DemoStage>
    </div>
  );
}
