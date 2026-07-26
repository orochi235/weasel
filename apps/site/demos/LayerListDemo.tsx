import {
  SceneCanvas,
  WeaselProvider,
  useSceneAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@weasel-js/core';
// `LayerList` + `useLayerList` are WeaselDraw-side specializations
// (kit/app split): they live under `apps/draw/src/ui/`. Imported
// via relative path because both directories are part of this monorepo.
import { LayerList, useLayerList } from '../../draw/src/ui/LayerList';
import type { DrawCommand } from '../../../packages/core/src/renderer';

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

  const select = useSelectTool(adapter, { getSelection: () => selection.current });
  const tools = useTools({ active: 'select', registry: { select } });

  const layerList = useLayerList({
    scene, selection, adapter,
    itemFor: (n) => ({ label: (n.data as Rect).color, swatch: (n.data as Rect).color }),
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
