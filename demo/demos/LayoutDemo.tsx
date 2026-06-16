import { useState, useMemo, useSyncExternalStore } from 'react';
import {
  SceneCanvas,
  sceneFromJSON,
  freeform,
  tileGrid,
  snapPoint,
} from '@weasel-js/core';
import type { SerializedScene } from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import sceneJson from './data/layout.scene.json';

// --- Scene model ---
//
// Three side-by-side container nodes (F = freeform, G = tileGrid, S = snapPoint),
// each holding a single child rect. Dragging a child into a different container
// triggers the layout-aware move pass: the destination strategy reflows its
// hypothetical children, the source strategy reflows its leftovers, and the
// commit batch reparents the dragged child + writes the reflowed poses.

type P = { x: number; y: number; width: number; height: number };
type Data = { color: string; isContainer: boolean };

export function LayoutDemo() {
  const [scene] = useState(() =>
    sceneFromJSON(
      sceneJson as unknown as SerializedScene<Data, 'default', P>,
      {},
    ),
  );
  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const layouts = useMemo(() => ({
    F: freeform<P>(),
    G: tileGrid<P>({ cols: 2, rows: 2 }),
    S: snapPoint<P>({ pattern: 'corners' }),
  }), []);

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
      <SceneCanvas
        width={620}
        height={260}
        scene={scene}
        layouts={layouts}
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
          // Outline-only selection — this demo's about layout, not resize.
          selectionOverlay: { handles: false },
        }}
      />
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
