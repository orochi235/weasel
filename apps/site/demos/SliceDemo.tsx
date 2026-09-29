import {
  asNodeId,
  boundsOfPath,
  ellipsePath,
  rectPath,
  SceneCanvas,
  solid,
  starPath,
  useScene,
  useSliceTool,
  type Path,
} from '@weasel-js/core';

const W = 480, H = 320;

const leaf = (id: string, path: Path, color: string) => {
  const { x, y, width, height } = boundsOfPath(path);
  return {
    id: asNodeId(id),
    kind: 'leaf' as const,
    layer: 'default' as const,
    parent: null,
    pose: { x, y, width, height },
    data: { path, fill: solid(color) },
  };
};

const INITIAL = [
  leaf('rect', rectPath(40, 60, 160, 200), '#7ab8d4'),
  leaf('disc', ellipsePath({ x: 230, y: 40, width: 120, height: 120 }), '#d4a574'),
  leaf('star', starPath({ x: 370, y: 220 }, 80, 5, 36, -Math.PI / 2), '#a48bd4'),
];

export function SliceDemo() {
  // `<SceneCanvas>` publishes the `slice` dep over its own scene, so the tool
  // is all this needs: every cut swaps the paths it crosses for their pieces.
  const scene = useScene({ systemLayers: [{ id: 'default' }], initial: INITIAL });
  const slice = useSliceTool();
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      features={['pick', 'move', 'edit']}
      tools={{ slice }}
      initialActiveTool="slice"
    />
  );
}
