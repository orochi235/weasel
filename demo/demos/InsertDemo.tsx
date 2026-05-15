import { useMemo, useRef } from 'react';
import {
  SceneCanvas,
  sceneToAdapter,
  useInsertTool,
  useScene,
  useTools,
} from '@orochi235/weasel';
import type { SceneNode } from '@orochi235/weasel';

interface Rect { id: string; x: number; y: number; width: number; height: number; color: string }
type RectNode = SceneNode<Rect, 'default', Rect>;

const W = 400, H = 300;
const COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#d47a7a', '#7ab8d4'];

export function InsertDemo() {
  const scene = useScene<Rect>({ items: [] });
  const nextId = useRef(0);

  const adapter = useMemo(() => {
    const a = sceneToAdapter(scene, {
      commitInsert: (b) => {
        const id = `r${nextId.current++}`;
        const data: Rect = {
          id,
          x: b.x, y: b.y, width: b.width, height: b.height,
          color: COLORS[nextId.current % COLORS.length],
        };
        return { pose: data, data, id };
      },
    });
    // sceneToAdapter widens commitInsert/commitPaste/snapshotSelection to
    // optional; useInsertTool only invokes commitInsert, but the InsertAdapter
    // contract is wider, so the other two get harmless stubs to satisfy TS.
    return Object.assign(a, {
      commitInsert: a.commitInsert!,
      commitPaste: () => [],
      snapshotSelection: () => ({ items: [] }),
    });
  }, [scene]);

  const insert = useInsertTool<RectNode, Rect>(adapter, { minBounds: { width: 4, height: 4 } });
  const tools = useTools({ active: 'insert', registry: { insert } });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      tools={tools}
      selectionMode="none"
      layers={{
        scene: {
          drawOne: (_node, p) => [{
            kind: 'path',
            path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
            fill: { color: p.color },
          }],
        },
        selectionOverlay: null,
      }}
    />
  );
}
