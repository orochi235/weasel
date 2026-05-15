import { useState, useMemo, useSyncExternalStore } from 'react';
import {
  asNodeId,
  nestedHitTester,
  SceneCanvas,
  sceneFromJSON,
  sceneToAdapter,
  useNest,
  useUnnest,
  useSelectTool,
  useSelection,
  useTools,
} from '@orochi235/weasel';
import type { SceneNode, SerializedScene } from '@orochi235/weasel';
import type { DrawCommand } from '../../src/renderer';
import sceneJson from './data/nesting.scene.json';

interface NodeData { color: string }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }
type DemoNode = SceneNode<NodeData, LayerId, Pose>;

const W = 480, H = 320;

// Scene v1 stores absolute world poses, so the kit's compose/decompose
// reduces to identity here. Nest/unnest math becomes a no-op: children's
// world poses are already correct; reparenting only changes the tree.
const composeAbs = <P,>(_parent: P, child: P): P => child;
const decomposeAbs = <P,>(_parent: P, world: P): P => world;

export function NestingDemo() {
  const [scene] = useState(() =>
    sceneFromJSON(
      sceneJson as unknown as SerializedScene<NodeData, LayerId, Pose>,
      {},
    ),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const selection = useSelection();

  // `cascadeContainerPose: 'rect'` opts into the scene v1 "containers translate
  // descendants on setPose" semantic so dragging a parent moves its children.
  // Everything else — insertNode/removeNode, getParent, getSelection — comes
  // out of sceneToAdapter at the right shape for the nesting hooks.
  const adapter = useMemo(
    () => sceneToAdapter(scene, { selection, cascadeContainerPose: 'rect' }),
    [scene, selection],
  );

  useNest(adapter, {
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
  useUnnest(adapter, {
    composePose: composeAbs,
    decomposePose: decomposeAbs,
    isGroup: (_id, obj) => obj?.kind === 'container',
  });

  // Nesting hit resolution: `pickOutermost` is the chrome-level body hit
  // (casual click → whole top-level ancestor). `pickBest` is the alt-aware
  // variant the select tool consults: without Alt → outermost ancestor;
  // with Alt → one level deeper per click, drilling ancestor → descendant → leaf.
  const hitter = useMemo(
    () => nestedHitTester(adapter, {
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
