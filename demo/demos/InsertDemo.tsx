import { useMemo } from 'react';
import {
  SceneCanvas,
  WeaselProvider,
  sceneToAdapter,
  useInsertTool,
  useScene,
  useTools,
} from '@orochi235/weasel';
import type { SceneNode } from '@orochi235/weasel';

// Per-shape data the kit's insert dep mints: `{ path, fill }` (see
// `useInsertDepSource`). Pose is plain `{ x, y, width, height }`.
interface RectData { path: unknown; fill: string }
interface RectPose { x: number; y: number; width: number; height: number }
type RectNode = SceneNode<RectData, 'default', RectPose>;

const W = 400, H = 300;

function InsertDemoInner() {
  const scene = useScene<RectData, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });

  // The kit ships the entire insert flow now:
  //   - `useInsertDepSource` (wired internally by SceneCanvas) mints node
  //     data + pose on commit, using the kit's default fill palette.
  //   - `defaultDrawOne` (the scene-slot default) dispatches through the
  //     `kit:path` painter to render the minted `data.path` + `data.fill`.
  // So this demo just sets up the tool; no custom commit / drawOne needed.
  const adapter = useMemo(() => {
    const a = sceneToAdapter<RectData, 'default', RectPose>(scene);
    return Object.assign(a, {
      commitInsert: () => null,
      commitPaste: () => [],
      snapshotSelection: () => ({ items: [] }),
    });
  }, [scene]);

  const insert = useInsertTool<RectNode, RectPose>(adapter, { minBounds: { width: 4, height: 4 } });
  const tools = useTools({ active: 'insert', registry: { insert } });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      tools={tools}
      selectionMode="none"
      layers={{ selectionOverlay: null }}
    />
  );
}

export function InsertDemo() {
  return <WeaselProvider><InsertDemoInner /></WeaselProvider>;
}
