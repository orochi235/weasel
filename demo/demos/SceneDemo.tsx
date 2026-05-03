import { useMemo } from 'react';
import {
  SceneCanvas,
  useScene,
  useSelection,
  useUndoRedo,
} from '@orochi235/weasel';
import type { RegisteredOp, Scene } from '@orochi235/weasel';

type LayerId = 'garden' | 'blueprint' | 'structures' | 'zones' | 'plantings';
interface NodeData { color: string; label?: string }
interface Pose { x: number; y: number; width: number; height: number }

const W = 480, H = 320;

const LAYER_COLORS: Record<LayerId, string> = {
  garden: '#f4e9d8',
  blueprint: '#cfd8e3',
  structures: '#d4a574',
  zones: 'rgba(164, 139, 212, 0.55)',
  plantings: '#7fb069',
};

// Consumer op: recolor a node. Routed through the same undo stack as kit ops.
interface SetColorPayload { id: string; from: string; to: string }
function makeSetColor(scene: Scene<NodeData, LayerId, Pose>): RegisteredOp<SetColorPayload> {
  return {
    apply: (p) => {
      const n = scene.get(p.id as never);
      if (n) (n as { data: NodeData }).data = { ...n.data, color: p.to };
    },
    revert: (p) => {
      const n = scene.get(p.id as never);
      if (n) (n as { data: NodeData }).data = { ...n.data, color: p.from };
    },
  };
}

export function SceneDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [
      { id: 'garden' },
      { id: 'blueprint' },
      { id: 'zones' },
      { id: 'structures' },
      { id: 'plantings' },
    ],
    initial: [
      // Garden backdrop (root)
      { id: 'garden-bg' as never, kind: 'leaf', layer: 'garden',
        pose: { x: 0, y: 0, width: W, height: H }, data: { color: LAYER_COLORS.garden } },
      // A zone (under structures? no, on zones layer)
      { id: 'zone-a' as never, kind: 'leaf', layer: 'zones',
        pose: { x: 40, y: 40, width: 200, height: 220 }, data: { color: LAYER_COLORS.zones } },
      // A structure (container)
      { id: 'planter-1' as never, kind: 'container', layer: 'structures',
        pose: { x: 60, y: 80, width: 160, height: 100 }, data: { color: LAYER_COLORS.structures, label: 'Planter' } },
      // A planting (leaf, parented under the structure but on a different layer — cross-layer parenting)
      { id: 'plant-a' as never, kind: 'leaf', layer: 'plantings',
        pose: { x: 80, y: 100, width: 30, height: 30 }, data: { color: LAYER_COLORS.plantings },
        parent: 'planter-1' as never },
      { id: 'plant-b' as never, kind: 'leaf', layer: 'plantings',
        pose: { x: 130, y: 110, width: 30, height: 30 }, data: { color: LAYER_COLORS.plantings },
        parent: 'planter-1' as never },
    ],
  });

  // Register the consumer op once; bind to the live scene so apply/revert
  // mutate it directly. Stable across renders via useMemo.
  useMemo(() => {
    scene.registerOp<SetColorPayload>('setColor', makeSetColor(scene));
  }, [scene]);

  const selection = useSelection();
  useUndoRedo(scene, { bindKeyboard: true });

  const recolorSelection = () => {
    const ids = selection.get();
    if (ids.length === 0) return;
    scene.batch('recolor', () => {
      for (const id of ids) {
        const n = scene.get(id as never);
        if (!n) continue;
        const next = `hsl(${Math.floor(Math.random() * 360)} 60% 65%)`;
        scene.recordOp({ kind: 'setColor', payload: { id, from: n.data.color, to: next } });
      }
    });
  };

  return (
    <div tabIndex={0} style={{ outline: 'none' }}>
      <div style={{ marginBottom: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => scene.undo()} disabled={!scene.canUndo()}>Undo</button>
        <button onClick={() => scene.redo()} disabled={!scene.canRedo()}>Redo</button>
        <button onClick={recolorSelection}>Recolor selection</button>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          Cmd/Ctrl+Z undo · Shift+Cmd/Ctrl+Z redo · drag rects to move
        </span>
      </div>
      <SceneCanvas<NodeData, LayerId, Pose>
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        layers={{
          scene: {
            drawOne: (cx, node, p) => {
              cx.fillStyle = node.data.color;
              cx.fillRect(p.x, p.y, p.width, p.height);
              cx.strokeStyle = 'rgba(0,0,0,0.3)';
              cx.strokeRect(p.x + 0.5, p.y + 0.5, p.width - 1, p.height - 1);
              if (node.data.label) {
                cx.fillStyle = 'rgba(0,0,0,0.7)';
                cx.font = '11px sans-serif';
                cx.fillText(node.data.label, p.x + 6, p.y + 14);
              }
            },
          },
          selectionOverlay: { handles: false },
        }}
      />
    </div>
  );
}

export const SCENE_DEMO_SOURCE = `// Kit-owned scene primitive — useScene + SceneCanvas wire everything.
// Layers, parenting, and undo/redo are first-class on the Scene; consumer
// ops register through the same undo stack as kit mutations.

const scene = useScene<NodeData, LayerId, Pose>({
  systemLayers: [
    { id: 'garden' }, { id: 'blueprint' },
    { id: 'structures' }, { id: 'zones' }, { id: 'plantings' },
  ],
  initial: [
    { id: 'planter-1', kind: 'container', layer: 'structures', pose, data, },
    // Cross-layer parenting: the leaf is on 'plantings', its parent on 'structures'.
    { id: 'plant-a',  kind: 'leaf',     layer: 'plantings',  pose, data, parent: 'planter-1' },
  ],
});

// Consumer op participates in the same undo stack as scene.add / scene.setPose.
scene.registerOp<SetColorPayload>('setColor', { apply, revert });

useUndoRedo(scene, { bindKeyboard: true }); // Cmd+Z / Cmd+Shift+Z

return (
  <SceneCanvas
    width={W} height={H} scene={scene}
    layers={{
      scene: { drawOne: (cx, node, pose) => { /* ... */ } },
      selectionOverlay: { handles: false },
    }}
  />
);
`;
