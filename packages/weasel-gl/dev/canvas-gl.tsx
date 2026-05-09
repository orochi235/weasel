import React from 'react';
import { createRoot } from 'react-dom/client';
import { SceneCanvas } from '../../../src/canvas/SceneCanvas';
import { useScene } from '../../../src/core/scene/useScene';
import { createPathLayer } from '../../../src/features/paths/pathLayer';
import type { Path } from '../../../src/features/paths/types';

interface RectItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

const NODES: RectItem[] = [
  { id: 'red', x: 100, y: 100, width: 80, height: 80, color: '#cc3344' },
  { id: 'blue', x: 220, y: 200, width: 60, height: 100, color: '#3366cc' },
];

function App(): React.ReactElement {
  const scene = useScene<RectItem>({ items: [] });

  // Build a path layer that emits the two rects via drawGL. We use a closure
  // over the static NODES array — getNodes is called per-frame. This is the
  // GL-side analog of the existing dev/layers.ts smoke; here it is dispatched
  // through <SceneCanvas backend="gl">.
  const pathsLayer = React.useMemo(() => createPathLayer<RectItem>({
    id: 'paths',
    label: 'Paths',
    getNodes: () => NODES,
    getPath: (n): Path => ({ kind: 'rect', x: n.x, y: n.y, width: n.width, height: n.height }),
    getFill: (n) => ({ fill: 'solid', color: n.color }),
  }), []);

  return (
    <SceneCanvas
      scene={scene}
      width={512}
      height={512}
      backend="gl"
      layers={{
        grid: {
          spacing: 50,
          bounds: () => ({ x: 0, y: 0, width: 400, height: 400 }),
          accentEvery: 4,
          style: {
            line:   { paint: { fill: 'solid', color: '#444' }, width: 1 },
            accent: { paint: { fill: 'solid', color: '#666' }, width: 1.5 },
            sub:    { paint: { fill: 'solid', color: '#222' }, width: 1 },
          },
          highlight: {
            spacing: 50,
            getCell: () => ({ col: 2, row: 2 }),
            fill: { fill: 'solid', color: 'rgba(127, 176, 105, 0.6)' },
          },
        },
        myPaths: { layer: pathsLayer },
      }}
    />
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
const status = document.getElementById('status');
if (status) status.textContent = 'Mounted <SceneCanvas backend="gl">.';
