import { useState, useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  worldPoseOf,
  asNodeId,
  easeOutCubic,
  sceneFromJSON,
  useAnimatedReflow,
  useDepSource, movePreset, pickPreset,
} from '@weasel-js/core';
import { useAnimator } from '@weasel-js/animator/react';
import { freeform, snapPoint, tileGrid } from '@weasel-js/guides';
import type { Fill, Scene, SerializedScene, Stroke } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import sceneJson from './data/layout.scene.json';
import { DemoStage } from './DemoStage';
import s from './LayoutDemo.module.css';

type P = { x: number; y: number; width: number; height: number };
type Data = { fill: Fill; stroke?: Stroke; isContainer: boolean };

const G = asNodeId('G');

/** The containers are marks, so a drop lands in one only because this says it may. */
function LayoutsTakeDrops({ scene }: { scene: Scene<Data, 'default', P> }): null {
  useDepSource('canDropInto', () => (parent) => scene.layoutOf(asNodeId(parent)) != null);
  return null;
}
const TILE_COLORS = ['#f5e3a3', '#e3a3f5', '#a3e3f5'];

export function LayoutDemo() {
  const [scene] = useState(() =>
    sceneFromJSON(
      sceneJson as unknown as SerializedScene<Data, 'default', P>,
      {
        registry: {
          layout: {
            freeform: freeform<P>(),
            tileGrid: tileGrid<P>({ cols: 2, rows: 2 }),
            snapPoint: snapPoint<P>({ pattern: 'corners' }),
          },
        },
      },
    ),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  // Opt-in: displaced siblings glide to their slots instead of snapping — on a
  // drag, and on every reflow the scene records.
  const [animate, setAnimate] = useState(true);
  const animator = useAnimator();
  const reflow = useAnimatedReflow(scene, animator, animate ? { ms: 220, easing: easeOutCubic } : null);

  const tiles = scene.childrenOf(G).length;
  const addTile = () => {
    scene.add({
      kind: 'mark',
      layer: 'default',
      parent: G,
      // In G's frame: G's bottom-right corner.
      pose: { x: 75, y: 185, width: 30, height: 30 },
      data: { fill: { paint: { color: TILE_COLORS[tiles % TILE_COLORS.length] } }, isContainer: false },
    });
  };

  // Every tile's committed world pose and parent, in or out of a container.
  const rows = scene.roots
    .flatMap((rootId) => [rootId, ...scene.childrenOf(rootId)])
    .filter((id) => !scene.get(id)!.data.isContainer)
    .map((childId) => {
      const child = scene.get(childId)!;
      const pose = worldPoseOf(scene, childId, 'document')!;
      return {
        id: childId as string,
        parent: child.parent as string | null,
        text: `${childId}:${Math.round(pose.x)},${Math.round(pose.y)}`,
      };
    });

  return (
    <div className="ckd-demo">
      <DemoStage width={620} height={260}>
        <SceneCanvas features={[pickPreset, movePreset]}
          scene={scene}
          reflowTransition={reflow}
        >
          <LayoutsTakeDrops scene={scene} />
        </SceneCanvas>
      </DemoStage>
      <div className="ckd-toolbar">
        <Button onClick={addTile} disabled={tiles >= 4}>add tile</Button>
        <Checkbox isSelected={animate} onChange={setAnimate}>animate reflow</Checkbox>
      </div>
      <ul className={s.ledger}>
        {rows.map((row) => (
          <li
            key={row.id}
            data-testid={`ld-pose-${row.id}`}
            data-parent={row.parent ?? ''}
          >
            {row.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
