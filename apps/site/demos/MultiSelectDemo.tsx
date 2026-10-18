import { SceneCanvas, useScene } from '@weasel-js/core';
import type { Fill } from '@weasel-js/core';
import { DemoStage } from './DemoStage';

interface Rect { id: string; x: number; y: number; width: number; height: number; fill: Fill }

const W = 400, H = 300;

const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 40,  width: 70, height: 50, fill: { paint: { color: '#7fb069' } } },
  { id: 'b', x: 150, y: 70,  width: 60, height: 60, fill: { paint: { color: '#d4a574' } } },
  { id: 'c', x: 250, y: 50,  width: 80, height: 70, fill: { paint: { color: '#a48bd4' } } },
  { id: 'd', x: 90,  y: 170, width: 60, height: 60, fill: { paint: { color: '#7ab8d4' } } },
  { id: 'e', x: 220, y: 180, width: 90, height: 60, fill: { paint: { color: '#d47a7a' } } },
];

export function MultiSelectDemo() {
  const scene = useScene({ items: INITIAL });
  return (
    <DemoStage width={W} height={H}>
      <SceneCanvas
        features={['pick', 'move', 'transform']}
        className="ckd-canvas"
        scene={scene}
        selectionOptions={{ mode: 'multi' }}
      />
    </DemoStage>
  );
}
