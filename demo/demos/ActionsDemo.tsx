import { useMemo, useRef, useState } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneToAdapter,
  useEscape,
  useSelectAll,
  useDuplicate,
  useNudge,
  useReorder,
  useScene,
  useSelection,
  type NodeId,
} from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];

export function ActionsDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { id: 'a' as never, kind: 'leaf', layer: 'default',
        pose: { x:  50, y:  60, width: 70, height: 50 }, data: { color: '#7fb069' } },
      { id: 'b' as never, kind: 'leaf', layer: 'default',
        pose: { x: 170, y:  90, width: 80, height: 60 }, data: { color: '#d4a574' } },
      { id: 'c' as never, kind: 'leaf', layer: 'default',
        pose: { x: 290, y: 160, width: 60, height: 50 }, data: { color: '#a48bd4' } },
    ],
  });
  const selection = useSelection();
  const [focused, setFocused] = useState(false);
  const nextId = useRef(1);

  const adapter = useMemo(() => {
    const base = sceneToAdapter(scene, { selection });
    return {
      ...base,
      getSelection: selection.adapterMethods.getSelection,
      setSelection: selection.adapterMethods.setSelection,
      getParent: (id: string): string | null => scene.get(asNodeId(id))?.parent ?? null,
      listAll: (): NodeId[] => [...scene.renderOrder()],
      insertNode: (node: { id: NodeId; pose: Pose; data: NodeData }) => {
        scene.add({
          kind: 'leaf',
          layer: 'default',
          pose: node.pose,
          data: node.data,
          id: node.id,
        });
      },
      cloneNode: (id: NodeId, offset: { dx: number; dy: number }) => {
        const src = scene.get(id);
        if (!src) throw new Error(`ActionsDemo: missing source ${id}`);
        const newId = asNodeId(`r${nextId.current++}`);
        return {
          id: newId,
          pose: {
            x: (src.pose as Pose).x + offset.dx,
            y: (src.pose as Pose).y + offset.dy,
            width: (src.pose as Pose).width,
            height: (src.pose as Pose).height,
          },
          data: { color: COLORS[(nextId.current + 2) % COLORS.length] },
        };
      },
    };
  }, [scene, selection]);

  useEscape(adapter, { enableKeyboard: focused });
  useSelectAll(adapter, { enableKeyboard: focused });
  useDuplicate<Pose>(adapter, { enableKeyboard: focused });
  useNudge<Pose>(adapter, { enableKeyboard: focused, step: 2, shiftStep: 20 });
  useReorder(adapter, { enableKeyboard: focused });

  return (
    <div
      tabIndex={0}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{ display: 'flex', flexDirection: 'column', gap: 6, outline: 'none' }}
    >
      <div style={{ fontSize: 11, color: focused ? '#7fb069' : '#7a6a52' }}>
        {focused
          ? 'Keys live: Esc / Cmd-A / Cmd-D / arrows (shift = bigger step) / Cmd-[ / Cmd-]'
          : 'Click the canvas to enable keyboard shortcuts'}
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        actions={null}
        layers={{
          scene: {
            drawOne: (n, p): DrawCommand[] => [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: n.data.color },
            }],
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}
