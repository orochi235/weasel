import { useState } from 'react';
import { SceneCanvas } from '@weasel-js/core';
import { DevtoolsPanel, createInPagePanelTransport } from '@weasel-js/devtools';
import { devtools } from '@weasel-js/devtools/hook';
import * as presets from '@weasel-js/editing/presets';
import { DemoStage } from './DemoStage';
import s from './DevtoolsDemo.module.css';

const SCENE = {
  version: 3,
  systemLayers: [{ id: 'shapes' }],
  nodes: [
    { id: 'sun', kind: 'mark', layer: 'shapes', pose: { x: 40, y: 40, width: 80, height: 80 }, data: { fill: { paint: { color: '#e8b04a' } } } },
    { id: 'sea', kind: 'mark', layer: 'shapes', pose: { x: 30, y: 200, width: 260, height: 60 }, data: { fill: { paint: { color: '#4a90d9' } } } },
    { id: 'boat', kind: 'mark', layer: 'shapes', pose: { x: 150, y: 160, width: 70, height: 40 }, data: { fill: { paint: { color: '#c0504d' } } } },
  ],
};

/** The canvas takes the `devtools` contribution, which registers it with the hook the panel reads. */
const AMBIENT = [devtools];

export function DevtoolsDemo() {
  const [transport] = useState(() => createInPagePanelTransport());
  return (
    <div className={s.demo}>
      <DemoStage width={320} height={300}>
        <SceneCanvas
          className="ckd-canvas"
          aria-label="Devtools demo canvas"
          scene={SCENE}
          features={[presets.pick, presets.move]}
          ambient={AMBIENT}
        />
      </DemoStage>
      <div className={s.panel}>
        <DevtoolsPanel transport={transport} tabs={['scene', 'state', 'dispatch']} />
      </div>
    </div>
  );
}
