import { WeaselRenderer, type DrawCommand } from '../src/index';
import { createPathLayer } from '../../../src/features/paths/pathLayer';
import { createGridLayer } from '../../../src/features/grid/layer';
import { createCellHighlightLayer } from '../../../src/features/grid/cellHighlight';
import type { Path } from '../../../src/features/paths/types';
import type { Paint } from '../../../src/core/paint';

const status = document.getElementById('status')!;

const view = { x: 0, y: 0, scale: 1 };
const dims = { width: 512, height: 512 };

interface PathNode { id: string; path: Path; fill: Paint; }

const nodes: PathNode[] = [
  {
    id: 'red',
    path: { kind: 'rect', x: 100, y: 100, width: 80, height: 80 },
    fill: { fill: 'solid', color: '#cc3344' },
  },
  {
    id: 'blue',
    path: { kind: 'rect', x: 220, y: 200, width: 60, height: 100 },
    fill: { fill: 'solid', color: '#3366cc' },
  },
];

const grid = createGridLayer({
  spacing: 50,
  bounds: () => ({ x: 0, y: 0, width: 400, height: 400 }),
  accentEvery: 4,
  style: {
    line:   { paint: { fill: 'solid', color: '#444' }, width: 1 },
    accent: { paint: { fill: 'solid', color: '#666' }, width: 1.5 },
    sub:    { paint: { fill: 'solid', color: '#222' }, width: 1 },
  },
});

const cell = createCellHighlightLayer({
  spacing: 50,
  getCell: () => ({ col: 2, row: 2 }),
  fill: { fill: 'solid', color: 'rgba(127, 176, 105, 0.6)' },
});

const paths = createPathLayer<PathNode>({
  getNodes: () => nodes,
  getPath: (n) => n.path,
  getFill: (n) => n.fill,
});

const tree: DrawCommand[] = [
  ...grid.drawGL!(null, view, dims),
  ...cell.drawGL!(null, view, dims),
  ...paths.drawGL!(null, view, dims),
];

const canvas = document.getElementById('c') as HTMLCanvasElement;
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
if (!gl) throw new Error('WebGL2 not available');

const renderer = new WeaselRenderer({ gl, canvas, width: dims.width, height: dims.height, dpr: window.devicePixelRatio || 1 });
renderer.render(tree);

status.textContent = `Layers smoke ready — ${tree.length} top-level commands.`;
