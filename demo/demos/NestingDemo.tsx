import { useState, useSyncExternalStore } from 'react';
import {
  asNodeId,
  SceneCanvas,
  sceneFromJSON,
  useSceneAdapter,
  useNest,
  useUnnest,
  useNestedSelectTool,
  useSelection,
  useTools,
} from '@orochi235/weasel';
import type { SceneNode, SerializedScene } from '@orochi235/weasel';
import sceneJson from './data/nesting.scene.json';

interface NodeData { color: string; shape?: 'ellipse' }
type LayerId = 'default';
interface Pose { x: number; y: number; width: number; height: number }
type DemoNode = SceneNode<NodeData, LayerId, Pose>;

const W = 540, H = 320;

// Scene v1 stores absolute world poses, so the kit's compose/decompose
// reduces to identity here. Nest/unnest math becomes a no-op: children's
// world poses are already correct; reparenting only changes the tree.
const composeAbs = <P,>(_parent: P, child: P): P => child;
const decomposeAbs = <P,>(_parent: P, world: P): P => world;

export function NestingDemo() {
  // Scene mixes two container shapes:
  //   - Two rect containers (g1 / g2) showing nested-group selection
  //   - One ellipse container (bed) — `data: { shape: 'ellipse' }`
  //     triggers the kit:shape painter, which supplies BOTH the visual
  //     and the clip silhouette; child rects are clipped to the ellipse.
  const [scene] = useState(() =>
    sceneFromJSON(sceneJson as unknown as SerializedScene<NodeData, LayerId, Pose>, {}),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const selection = useSelection();

  // `cascadeContainerPose: 'rect'` opts into the scene v1 "containers
  // translate descendants on setPose" semantic so dragging a container
  // moves its children — and the preview ghost clips them to the
  // previewed silhouette during the drag.
  const adapter = useSceneAdapter(scene, { selection, cascadeContainerPose: 'rect' });

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

  // useNestedSelectTool turns on alt-aware nested selection: casual click
  // selects the outermost ancestor; alt-click drills ancestor → child → leaf.
  const select = useNestedSelectTool<DemoNode, Pose>(adapter, {
    composePose: composeAbs,
    isGroup: (_id, obj) => obj?.kind === 'container',
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
    />
  );
}
