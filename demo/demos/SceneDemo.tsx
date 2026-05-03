import { useMemo } from 'react';
import {
  Canvas,
  sceneToAdapter,
  useScene,
  useSelection,
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
      { id: 'garden-bg' as never, kind: 'leaf', layer: 'garden',
        pose: { x: 0, y: 0, width: W, height: H }, data: { color: LAYER_COLORS.garden } },
      { id: 'zone-a' as never, kind: 'leaf', layer: 'zones',
        pose: { x: 280, y: 60, width: 160, height: 200 }, data: { color: LAYER_COLORS.zones, label: 'Sun zone' } },
      { id: 'planter-1' as never, kind: 'container', layer: 'structures',
        pose: { x: 60, y: 80, width: 160, height: 100 }, data: { color: LAYER_COLORS.structures, label: 'Planter' } },
      { id: 'plant-a' as never, kind: 'leaf', layer: 'plantings',
        pose: { x: 80, y: 100, width: 30, height: 30 }, data: { color: LAYER_COLORS.plantings },
        parent: 'planter-1' as never },
      { id: 'plant-b' as never, kind: 'leaf', layer: 'plantings',
        pose: { x: 130, y: 110, width: 30, height: 30 }, data: { color: LAYER_COLORS.plantings },
        parent: 'planter-1' as never },
    ],
  });

  useMemo(() => {
    scene.registerOp<SetColorPayload>('setColor', makeSetColor(scene));
  }, [scene]);

  const selection = useSelection();

  // Wrap the synthesized adapter to cascade-translate descendants when a
  // container is moved. Scene v1 stores absolute poses (no auto-reflow), so
  // physical containment is the consumer's responsibility — this is the
  // recipe.
  const adapter = useMemo(() => {
    const base = sceneToAdapter(scene);
    const collectDescendants = (id: string, out: string[]): void => {
      for (const cid of scene.childrenOf(id as never)) {
        out.push(cid);
        collectDescendants(cid, out);
      }
    };
    return {
      ...base,
      setPose(id: string, pose: Pose) {
        const n = scene.get(id as never);
        if (!n || n.kind !== 'container') {
          base.setPose(id, pose);
          return;
        }
        const dx = pose.x - n.pose.x;
        const dy = pose.y - n.pose.y;
        if (dx === 0 && dy === 0) {
          base.setPose(id, pose);
          return;
        }
        const desc: string[] = [];
        collectDescendants(id, desc);
        scene.batch('move container', () => {
          base.setPose(id, pose);
          for (const cid of desc) {
            const cn = scene.get(cid as never);
            if (!cn) continue;
            base.setPose(cid, { ...cn.pose, x: cn.pose.x + dx, y: cn.pose.y + dy });
          }
        });
      },
    };
  }, [scene]);

  // Live overlay cascade — ghosts of descendants follow the dragged parent.
  const cascadeWorldPose = (id: string): Pose | null => {
    const n = scene.get(id as never);
    return n ? n.pose : null;
  };

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
      <Canvas
        width={W}
        height={H}
        className="ckd-canvas"
        adapter={adapter}
        selection={selection}
        tool="none"
        gestures={{ undoRedo: { adapter: scene } }}
        moveOptions={{ cascadeWorldPose }}
        hitBody={(wx, wy) => {
          const ordered = [...scene.renderOrder()];
          for (let i = ordered.length - 1; i >= 0; i--) {
            const id = ordered[i];
            if (id === 'garden-bg') continue;
            const n = scene.get(id);
            if (!n) continue;
            const { x, y, width, height } = n.pose;
            if (wx >= x && wx <= x + width && wy >= y && wy <= y + height) return id;
          }
          return null;
        }}
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

export const SCENE_DEMO_SOURCE = `// Kit-owned scene primitive — useScene + Canvas wired via sceneToAdapter.
// Layers, parenting, and undo/redo are first-class on the Scene.

const scene = useScene<NodeData, LayerId, Pose>({
  systemLayers: [
    { id: 'garden' }, { id: 'blueprint' },
    { id: 'zones' }, { id: 'structures' }, { id: 'plantings' },
  ],
  initial: [
    { id: 'planter-1', kind: 'container', layer: 'structures', pose, data },
    // Cross-layer parenting: the leaf is on 'plantings', its parent on 'structures'.
    { id: 'plant-a',  kind: 'leaf',      layer: 'plantings',  pose, data, parent: 'planter-1' },
  ],
});

// Consumer op participates in the same undo stack as scene.add / scene.setPose.
scene.registerOp<SetColorPayload>('setColor', { apply, revert });

useUndoRedo(scene, { bindKeyboard: true });

// v1 Scene stores absolute poses — wrap setPose to cascade-translate
// descendants when a container moves.
const adapter = useMemo(() => {
  const base = sceneToAdapter(scene);
  return {
    ...base,
    setPose(id, pose) {
      const n = scene.get(id);
      if (!n || n.kind !== 'container') return base.setPose(id, pose);
      const dx = pose.x - n.pose.x, dy = pose.y - n.pose.y;
      const desc = []; collectDescendants(id, desc);
      scene.batch('move container', () => {
        base.setPose(id, pose);
        for (const cid of desc) {
          const cn = scene.get(cid);
          base.setPose(cid, { ...cn.pose, x: cn.pose.x + dx, y: cn.pose.y + dy });
        }
      });
    },
  };
}, [scene]);

return (
  <Canvas
    width={W} height={H} adapter={adapter}
    moveOptions={{ cascadeWorldPose: (id) => scene.get(id)?.pose ?? null }}
    layers={{ scene: { drawOne: (cx, node, pose) => { /* ... */ } } }}
  />
);
`;
