import { useState } from 'react';
import {
  asNodeId,
  rectPath,
  SceneCanvas,
  useScene,
  useSelection,
  solid,
  type LassoHitMode, pickPreset,
} from '@weasel-js/core';
import { SegmentedBar, type SegmentedBarItem } from '@weasel-js/ui/components/Segmented';
import { DemoStage } from './DemoStage';
import s from './LassoDemo.module.css';

const W = 480, H = 320;

const PALETTE = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a', '#e8c547', '#5fad9a'];
const INITIAL = (() => {
  const out = [];
  let i = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 8; col++) {
      const x = 20 + col * 55 + (row % 2) * 18;
      const y = 20 + row * 55;
      const width = 30 + ((i * 7) % 25);
      const height = 28 + ((i * 11) % 22);
      out.push({
        id: asNodeId(`r${i}`),
        kind: 'mark' as const,
        layer: 'default' as const,
        parent: null,
        pose: { x, y, width, height },
        data: { path: rectPath(x, y, width, height), fill: { paint: solid(PALETTE[i % PALETTE.length]) } },
      });
      i++;
    }
  }
  return out;
})();

const MODE_ITEMS: SegmentedBarItem<LassoHitMode>[] = [
  { value: 'centers', label: 'centers (snappy)' },
  { value: 'intersect', label: 'intersect (any overlap)' },
  { value: 'enclosed', label: 'enclosed (strict)' },
];

export function LassoDemo() {
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const selection = useSelection({ scene, mode: 'multi' });
  const [mode, setMode] = useState<LassoHitMode>('intersect');

  return (
    <div className={s.demo}>
      <div className={s.controls}>
        <span>Hit mode:</span>
        <SegmentedBar items={MODE_ITEMS} value={mode} onChange={(m) => m && setMode(m)} aria-label="Hit mode" size="sm" />
        <span className={s.keys}><kbd>V</kbd> select · <kbd>L</kbd> lasso</span>
      </div>
      <DemoStage width={W} height={H}>
        <SceneCanvas
          className="ckd-canvas"
          scene={scene}
          selection={selection}
          features={[pickPreset]}
          defaultTools={['lasso']}
          defaultActiveTool="lasso"
          toolOptions={{ lasso: { mode } }}
        />
      </DemoStage>
    </div>
  );
}
