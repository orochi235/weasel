import { SceneCanvas, solid, useScene, useSelection, type SolidPaint } from '@weasel-js/core';
import { LayerList, useSceneLayerList } from '@weasel-js/ui/components/LayerList';
import type { CSSProperties } from 'react';
import { DemoStage } from './DemoStage';

interface Rect { id: string; x: number; y: number; width: number; height: number; fill: { paint: SolidPaint } }

const W = 480, H = 320;
const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, fill: { paint: solid('#7fb069') } },
  { id: 'b', x: 130, y: 80,  width: 80, height: 60, fill: { paint: solid('#d4a574') } },
  { id: 'c', x: 220, y: 100, width: 80, height: 60, fill: { paint: solid('#a48bd4') } },
  { id: 'd', x: 310, y: 120, width: 80, height: 60, fill: { paint: solid('#7ab8d4') } },
  { id: 'e', x: 80,  y: 180, width: 80, height: 60, fill: { paint: solid('#d47a7a') } },
];

export function LayerListDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  // Lifted out of the canvas because the list reads and writes it too.
  const selection = useSelection({ mode: 'multi', scene });

  const layerList = useSceneLayerList({
    scene, selection,
    itemFor: (n) => {
      const { color } = (n.data as Rect).fill.paint;
      return {
        label: color,
        leading: <span className="ckd-swatch" style={{ '--ckd-swatch': color } as CSSProperties} aria-hidden="true" />,
      };
    },
  });

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <DemoStage width={W} height={H}>
        <SceneCanvas features={['pick']}
          className="ckd-canvas"
          scene={scene}
          selection={selection}
        />
      </DemoStage>
      <LayerList {...layerList} />
    </div>
  );
}
