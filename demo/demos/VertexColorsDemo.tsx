import { useMemo, useRef, useState } from 'react';
import { SceneCanvas, hexToRgba, polygonFromPoints, rgbaToHex, useHandleDrag, useScene } from '@orochi235/weasel';
import type { RenderLayer } from '@orochi235/weasel';
import { viewToMat3, type DrawCommand } from '../../src/renderer';

const W = 600;
const H = 400;
const N = 7;

interface Vertex { x: number; y: number; rgba: [number, number, number, number]; }

const RAINBOW: [number, number, number, number][] = [
  [1.0, 0.2, 0.3, 1.0],
  [1.0, 0.6, 0.1, 1.0],
  [1.0, 0.9, 0.2, 1.0],
  [0.3, 0.9, 0.4, 1.0],
  [0.2, 0.7, 0.95, 1.0],
  [0.4, 0.4, 0.95, 1.0],
  [0.7, 0.3, 0.9, 1.0],
];

function makeHeptagon(): Vertex[] {
  const cx = W / 2, cy = H / 2, r = 140;
  return Array.from({ length: N }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / N;
    return {
      x: cx + Math.cos(a) * r,
      y: cy + Math.sin(a) * r,
      rgba: RAINBOW[i % RAINBOW.length],
    };
  });
}

export function VertexColorsDemo() {
  const [verts, setVerts] = useState<Vertex[]>(makeHeptagon);
  const [showHandles, setShowHandles] = useState(true);

  const layer: RenderLayer<unknown> = useMemo(() => ({
    id: 'vertex-colored-poly',
    label: 'Vertex-colored polygon',
    draw: (_data, view) => {
      const path = polygonFromPoints(verts.map((v) => ({ x: v.x, y: v.y })));
      const colors = verts.flatMap((v) => v.rgba);
      const cmd: DrawCommand = {
        kind: 'path',
        path,
        fill: { color: '#ffffff' },  // required: drawPath bails without a fill; per-vertex colors modulate this
        vertexColors: colors,
      };
      return [{ kind: 'group', transform: viewToMat3(view), children: [cmd] }];
    },
  }), [verts]);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div className="ckd-stack">
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <label style={{ color: '#ddd' }}>
          <input
            type="checkbox"
            checked={showHandles}
            onChange={(e) => setShowHandles(e.target.checked)}
          />
          {' '}show handles
        </label>
        <button onClick={() => setVerts(makeHeptagon())} style={{ padding: '4px 10px' }}>Reset</button>
      </div>
      <div style={{ position: 'relative', width: W, height: H }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            poly: { layer, after: 'scene' },
          }}
        />
        {showHandles && (
          <Handles verts={verts} setVerts={setVerts} width={W} height={H} />
        )}
      </div>
    </div>
  );
}

function Handles({
  verts, setVerts, width, height,
}: {
  verts: Vertex[];
  setVerts: (v: Vertex[] | ((prev: Vertex[]) => Vertex[])) => void;
  width: number;
  height: number;
}) {
  return (
    <svg width={width} height={height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {verts.map((v, i) => (
        <VertexHandle
          key={i}
          v={v}
          onMove={(x, y) => setVerts((prev) => prev.map((p, j) => j === i ? { ...p, x, y } : p))}
          onRecolor={(rgba) => setVerts((prev) => prev.map((p, j) => j === i ? { ...p, rgba } : p))}
        />
      ))}
    </svg>
  );
}

function VertexHandle({
  v, onMove, onRecolor,
}: {
  v: Vertex;
  onMove: (x: number, y: number) => void;
  onRecolor: (rgba: [number, number, number, number]) => void;
}) {
  const swatchHex = rgbaToHex(v.rgba);
  const colorRef = useRef<HTMLInputElement>(null);
  const drag = useHandleDrag<SVGCircleElement>({
    onMove: ({ x, y }) => onMove(x, y),
  });
  return (
    <g style={{ pointerEvents: 'auto' }}>
      <circle
        cx={v.x}
        cy={v.y}
        r={9}
        fill={swatchHex}
        stroke="#fff"
        strokeWidth={2}
        style={{ cursor: 'grab' }}
        {...drag}
        onDoubleClick={(e) => {
          e.preventDefault();
          colorRef.current?.click();
        }}
      />
      <foreignObject x={v.x} y={v.y} width={1} height={1} style={{ overflow: 'visible' }}>
        <input
          ref={colorRef}
          type="color"
          value={swatchHex}
          onChange={(e) => onRecolor(hexToRgba(e.target.value))}
          style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}
        />
      </foreignObject>
    </g>
  );
}
