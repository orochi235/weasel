import {
  SceneCanvas,
  WeaselProvider,
  useRectTool,
  useScene,
  useTools,
} from '@weasel-js/core';

// Per-shape data the kit's insert dep mints: `{ path, fill }` (see
// `useInsertDepSource`). Pose is plain `{ x, y, width, height }`.
interface RectData { path: unknown; fill: string }
interface RectPose { x: number; y: number; width: number; height: number }

const W = 400, H = 300;

function InsertDemoInner() {
  const scene = useScene<RectData, 'default', RectPose>({ systemLayers: [{ id: 'default' }] });

  // The kit ships the entire insert flow. The tool is a declarative shell —
  // its `drag` binding routes to `insertAction`, which owns the live
  // preview and commits through the `insert` dep that `<SceneCanvas>` wires
  // internally (`useInsertDepSource` mints `data.path` + `data.fill` from
  // the kit's default palette, and `defaultDrawOne` paints it via the
  // `kit:path` painter). So this demo is just tool registration.
  const rect = useRectTool();
  const tools = useTools({ active: 'rect', registry: { rect } });

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
