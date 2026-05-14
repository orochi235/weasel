import { useMemo } from 'react';
import {
  asNodeId,
  createMoveToIndexOp,
  dispatchApplyBatch,
  SceneCanvas,
  sceneToAdapter,
  useScene,
  useSelection,
  useSelectTool,
  useTools,
} from '@orochi235/weasel';
import type { LayerListItem } from '@orochi235/weasel-ui';
// `LayerList` is a Swillustrator-side specialization (kit/app split):
// it lives under `apps/swillustrator/src/ui/`. Imported via relative path
// because both directories are part of this monorepo.
import { LayerList } from '../../apps/swillustrator/src/ui/LayerList';
import type { DrawCommand } from '../../src/renderer';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }

const W = 480, H = 320;
const INITIAL: Rect[] = [
  { id: 'a', x: 40,  y: 60,  width: 80, height: 60, color: '#7fb069' },
  { id: 'b', x: 130, y: 80,  width: 80, height: 60, color: '#d4a574' },
  { id: 'c', x: 220, y: 100, width: 80, height: 60, color: '#a48bd4' },
  { id: 'd', x: 310, y: 120, width: 80, height: 60, color: '#7ab8d4' },
  { id: 'e', x: 80,  y: 180, width: 80, height: 60, color: '#d47a7a' },
];

export function LayerListDemo() {
  const scene = useScene<Rect>({ items: INITIAL });
  const selection = useSelection({ mode: 'multi' });

  const adapter = useMemo(
    () => sceneToAdapter(scene, { selection }),
    [scene, selection],
  );

  const pickEvery = (worldX: number, worldY: number): string[] => {
    const hits: string[] = [];
    for (const id of scene.renderOrder()) {
      const n = scene.get(id);
      if (!n) continue;
      const p = n.pose as Rect;
      if (worldX >= p.x && worldX <= p.x + p.width
          && worldY >= p.y && worldY <= p.y + p.height) hits.push(id);
    }
    return hits;
  };

  const boundsOf = (id: string) => {
    const n = scene.get(asNodeId(id));
    if (!n) return null;
    const p = n.pose as Rect;
    return { x: p.x, y: p.y, width: p.width, height: p.height };
  };

  const select = useSelectTool(adapter, {
    pickEvery, boundsOf,
    getSelection: () => selection.current,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  // Derive items from scene render order — top of stack first.
  // renderOrder is bottom→top; reverse so index 0 is top. Computed each
  // render — scene's object identity is stable across reorders, so a
  // useMemo keyed on [scene] would serve stale items.
  const order = [...scene.renderOrder()].reverse();
  const items: LayerListItem[] = order.map((id) => {
    const n = scene.get(id);
    const data = n?.data as Rect | undefined;
    return { id, label: data?.color ?? id };
  });

  const onReorder = (ids: string[], targetIndex: number) => {
    // LayerList index is top-down (0 = front). Scene order is bottom-up.
    // Convert: scene-index = total - targetIndex.
    const total = [...scene.renderOrder()].length;
    const sceneIndex = total - targetIndex;
    dispatchApplyBatch(
      adapter,
      [createMoveToIndexOp({ ids, parentId: null, index: Math.max(0, sceneIndex - ids.length) })],
      'Reorder',
    );
  };

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
      <LayerList
        items={items}
        selectedIds={selection.current.map((id) => String(id))}
        onSelect={(ids) => selection.set(ids.map(asNodeId))}
        onReorder={onReorder}
      />
    </div>
  );
}
