import { useMemo } from 'react';
import {
  asNodeId,
  nestedGroupHitTester,
  SceneCanvas,
  sceneToAdapter,
  useNestedGroup,
  useNestedUngroup,
  useScene,
  useSelectTool,
  useSelection,
  useTools,
} from '@orochi235/weasel';
import type { NodeId, SceneNode } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }
type DemoNode = SceneNode<NodeData, LayerId, Pose>;

const W = 480, H = 320;

// Scene v1 stores absolute world poses, so the kit's compose/decompose
// reduces to identity here. Group/ungroup math becomes a no-op: children's
// world poses are already correct; reparenting only changes the tree.
const composeAbs = <P,>(_parent: P, child: P): P => child;
const decomposeAbs = <P,>(_parent: P, world: P): P => world;

// g1 contains g2 (a sub-group) + a free leaf `a`; g2 in turn contains b1, b2.
// Free leaves c, d sit alongside for ad-hoc grouping with Cmd+G. The data
// path supports arbitrary depth.
const INITIAL = [
  { id: asNodeId('g1'), kind: 'container' as const, layer: 'default' as const,
    pose: { x: 40, y: 40, width: 230, height: 150 }, data: { color: '#3a2e22' } },
  { id: asNodeId('a'), parent: asNodeId('g1'), kind: 'leaf' as const, layer: 'default' as const,
    pose: { x: 50, y: 50, width: 60, height: 50 }, data: { color: '#7fb069' } },
  { id: asNodeId('g2'), parent: asNodeId('g1'), kind: 'container' as const, layer: 'default' as const,
    pose: { x: 125, y: 85, width: 130, height: 90 }, data: { color: '#2e3a22' } },
  { id: asNodeId('b1'), parent: asNodeId('g2'), kind: 'leaf' as const, layer: 'default' as const,
    pose: { x: 133, y: 93, width: 50, height: 35 }, data: { color: '#a8d469' } },
  { id: asNodeId('b2'), parent: asNodeId('g2'), kind: 'leaf' as const, layer: 'default' as const,
    pose: { x: 193, y: 130, width: 50, height: 35 }, data: { color: '#a8d469' } },
  { id: asNodeId('c'), kind: 'leaf' as const, layer: 'default' as const,
    pose: { x: 320, y: 110, width: 90, height: 60 }, data: { color: '#d4a574' } },
  { id: asNodeId('d'), kind: 'leaf' as const, layer: 'default' as const,
    pose: { x: 220, y: 230, width: 70, height: 50 }, data: { color: '#a48bd4' } },
];

export function NestedGroupsDemo() {
  const scene = useScene<NodeData, LayerId, Pose>({
    systemLayers: [{ id: 'default' }],
    initial: INITIAL,
  });
  const selection = useSelection();

  // sceneToAdapter handles the bulk of the adapter contract; we layer on
  // (a) cascade-aware setPose so dragging a container moves its descendants
  // on commit, and (b) insertNode/removeNode so useNestedGroup's Insert/Delete
  // ops route into scene.add/remove (and stay undoable through scene.batch).
  const adapter = useMemo(() => {
    const base = sceneToAdapter(scene, { selection });
    const collectDesc = (root: string, out: string[]): void => {
      for (const cid of scene.childrenOf(asNodeId(root))) {
        out.push(cid);
        collectDesc(cid, out);
      }
    };
    return {
      ...base,
      // sceneToAdapter's getSelection / getParent are typed string-based and
      // partial; the nested-group hooks want concrete NodeId[] / non-optional.
      getSelection: (): NodeId[] => [...selection.adapterMethods.getSelection()],
      getParent: (id: string): string | null => scene.get(asNodeId(id))?.parent ?? null,
      setPose(id: string, pose: Pose) {
        const node = scene.get(asNodeId(id));
        if (!node || node.kind !== 'container') {
          base.setPose(id, pose);
          return;
        }
        const dx = pose.x - node.pose.x;
        const dy = pose.y - node.pose.y;
        if (dx === 0 && dy === 0) {
          base.setPose(id, pose);
          return;
        }
        const desc: string[] = [];
        collectDesc(id, desc);
        scene.batch('move container', () => {
          base.setPose(id, pose);
          for (const cid of desc) {
            const cn = scene.get(asNodeId(cid));
            if (!cn) continue;
            base.setPose(cid, { ...cn.pose, x: cn.pose.x + dx, y: cn.pose.y + dy });
          }
        });
      },
      insertNode(n: DemoNode) {
        scene.add({
          id: n.id,
          kind: n.kind,
          layer: n.layer,
          pose: n.pose,
          data: n.data,
          ...(n.parent !== null ? { parent: n.parent } : {}),
        });
      },
      removeNode(id: string) {
        scene.remove(asNodeId(id));
      },
    };
  }, [scene, selection]);

  useNestedGroup(adapter, {
    composePose: composeAbs,
    decomposePose: decomposeAbs,
    groupFactory: ({ id, localPose }): DemoNode => ({
      id: asNodeId(id),
      kind: 'container',
      layer: 'default',
      pose: localPose,
      data: { color: '#3a2e22' },
      parent: null,
      children: [],
    }),
  });
  useNestedUngroup(adapter, {
    composePose: composeAbs,
    decomposePose: decomposeAbs,
    isGroup: (_id, obj) => obj?.kind === 'container',
  });

  // Nested-group hit resolution: `pickOutermost` is the chrome-level body
  // hit (casual click → whole top-level group). `pickBest` is the alt-aware
  // variant the select tool consults: without Alt → outermost ancestor;
  // with Alt → one level deeper per click, drilling group → subgroup → leaf.
  const hitter = useMemo(
    () => nestedGroupHitTester(adapter, {
      composePose: composeAbs,
      isGroup: (_id, obj) => obj?.kind === 'container',
    }),
    [adapter],
  );

  const select = useSelectTool<DemoNode, Pose>(adapter, {
    pickEvery: () => [],
    pickBest: (wx, wy, alt, sel) => hitter.pickBest(wx, wy, alt, sel),
    boundsOf: (id) => scene.get(asNodeId(id))?.pose ?? null,
    getNode: (id) => adapter.getNode(id) ?? null,
    getSelection: () => selection.current,
  });
  const tools = useTools({ active: 'select', registry: { select } });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
      tools={tools}
      geometry={{ pickEvery: hitter.pickOutermost }}
      layers={{
        scene: {
          drawOne: (node, p): DrawCommand[] => {
            if (node.kind === 'container') {
              return [
                // Translucent fill via paint opacity (group-level alpha would
                // tint the dashed stroke too).
                {
                  kind: 'path',
                  path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                  fill: { color: node.data.color, opacity: 0.35 },
                },
                {
                  kind: 'path',
                  path: { kind: 'rect', x: p.x + 0.5, y: p.y + 0.5, width: p.width - 1, height: p.height - 1 },
                  stroke: { paint: { color: '#5a4a38' }, width: 1, dash: [4, 3] },
                },
              ];
            }
            return [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: node.data.color },
            }];
          },
        },
        selectionOverlay: { handles: { size: 0 } },
      }}
    />
  );
}
