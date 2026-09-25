import {
  SceneCanvas,
  WeaselProvider,
  useSceneAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@weasel-js/core';
import { LayerList, useSceneLayerList } from '@weasel-js/ui';
import type { CSSProperties } from 'react';
import type { DrawCommand } from '@weasel-js/core/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320;
const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 130, y: 80,  width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 220, y: 100, width: 80, height: 60, color: '#a48bd4' },
  { id: 'd', x: 310, y: 120, width: 80, height: 60, color: '#7ab8d4' },
  { id: 'e', x: 80,  y: 180, width: 80, height: 60, color: '#d47a7a' },
];

function LayerListDemoInner() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });
  const adapter = useSceneAdapter(scene, { selection });

  const select = useSelectTool(adapter, {});
  const tools = useTools({ active: 'select', registry: { select } });

  const layerList = useSceneLayerList({
    scene, selection, adapter,
    itemFor: (n) => {
      const { color } = n.data as Rect;
      return {
        label: color,
        leading: <span className="ckd-swatch" style={{ '--ckd-swatch': color } as CSSProperties} aria-hidden="true" />,
      };
    },
  });

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <SceneCanvas
        width={W} height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        selectionMode="multi"
        tools={tools}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: (n.data as Rect).color },
            }],
          },
        }}
      />
      <LayerList {...layerList} />
    </div>
  );
}

export function LayerListDemo() {
  return <WeaselProvider><LayerListDemoInner /></WeaselProvider>;
}
