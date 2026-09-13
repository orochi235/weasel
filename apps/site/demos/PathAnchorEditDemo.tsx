import {
  asNodeId,
  boundsOfPath,
  pathFromD,
  SceneCanvas,
  solid,
  useScene,
  useSelection,
  type Path,
} from '@weasel-js/core';

const W = 480, H = 300;

// The node shape the kit's built-in shape tools produce, so the default
// painter draws it and `editAnchors` edits `data.path` in place.
function pathNode(id: string, d: string, color: string) {
  const path: Path = pathFromD(d);
  const { x, y, width, height } = boundsOfPath(path);
  return {
    kind: 'leaf' as const,
    id: asNodeId(id),
    layer: 'default' as const,
    pose: { x, y, width, height },
    data: { path, fill: solid(color) },
  };
}

export function PathAnchorEditDemo() {
  const scene = useScene({
    systemLayers: [{ id: 'default' }],
    initial: [
      pathNode('kite', 'M140 40 L220 140 L140 260 L60 140 Z', '#7fb069'),
      pathNode('wave', 'M280 200 C300 60 400 60 420 200 Z', '#e0a458'),
    ],
  });
  const selection = useSelection();

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      selection={selection}
    />
  );
}
