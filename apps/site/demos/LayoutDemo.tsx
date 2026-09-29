import { useState, useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  asNodeId,
  easeOutCubic,
  sceneFromJSON,
  useAnimatedReflow,
  useAnimator,
} from '@weasel-js/core';
import { freeform, snapPoint, tileGrid } from '@weasel-js/guides';
import type { SerializedScene } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/core/renderer';
import sceneJson from './data/layout.scene.json';

// --- Scene model ---
//
// Three side-by-side container nodes (F = freeform, G = tileGrid, S = snapPoint),
// each holding a single child rect. Each container declares its layout in the
// scene (the JSON's `layoutKey`, resolved through the registry), so the scene
// keeps it arranged: a tile added to G packs into the next free cell. Dragging
// a child into a different container runs the layout-aware move pass: the
// destination strategy places it, the source strategy reflows its leftovers,
// and the commit reparents the dragged child in one undo step.

type P = { x: number; y: number; width: number; height: number };
type Data = { color: string; isContainer: boolean };

const G = asNodeId('G');
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
      kind: 'leaf',
      layer: 'default',
      parent: G,
      pose: { x: 285, y: 225, width: 30, height: 30 },
      data: { color: TILE_COLORS[tiles % TILE_COLORS.length], isContainer: false },
    });
  };

  // Committed-pose ledger: walk each container's leaf children and surface
  // their live pose + parent. Because the demo re-renders on scene version
  // change, these rows update the instant a drag commits — letting you watch
  // a child reparent and reflow into its destination container.
  const rows = scene.roots.flatMap((containerId) =>
    scene.childrenOf(containerId).map((childId) => {
      const child = scene.get(childId)!;
      const pose = child.pose as P;
      return {
        id: childId as string,
        parent: child.parent as string | null,
        text: `${childId}:${Math.round(pose.x)},${Math.round(pose.y)}`,
      };
    }),
  );

  return (
    <div>
      <SceneCanvas features={['pick', 'move']}
        width={620}
        height={260}
        scene={scene}
        reflowTransition={reflow}
        layers={{
          scene: {
            drawOne: (node, p): DrawCommand[] => {
              const cmds: DrawCommand[] = [{
                kind: 'path',
                path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
                fill: { color: node.data.color },
              }];
              if (node.data.isContainer) {
                cmds.push({
                  kind: 'path',
                  path: { kind: 'rect', x: p.x + 0.5, y: p.y + 0.5, width: p.width - 1, height: p.height - 1 },
                  stroke: { paint: { color: '#d4c4a8' }, width: 1 },
                });
              }
              return cmds;
            },
          },
        }}
      />
      <button className="ckd-btn" onClick={addTile} disabled={tiles >= 4}>add tile</button>
      <label className="ckd-field">
        <input type="checkbox" checked={animate} onChange={(e) => setAnimate(e.target.checked)} />
        animate reflow
      </label>
      <ul className="ld-ledger">
        {rows.map((row) => (
          <li
            key={row.id}
            className="ld-row"
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
