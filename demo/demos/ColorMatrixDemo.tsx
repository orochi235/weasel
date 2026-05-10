import { useMemo, useState } from 'react';
import { SceneCanvas, useScene } from '@orochi235/weasel';
import type { RenderLayer } from '@orochi235/weasel';
import { viewToMat3, type DrawCommand } from '../../src/renderer';

const W = 720;
const H = 360;

type PresetName = 'Identity' | 'Grayscale' | 'Sepia' | 'Invert' | 'Hue+90°' | 'Brightness×1.5';

function hueRotate(rad: number): number[] {
  // Standard hue-rotation matrix (luminance-preserving approximation).
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const lr = 0.213, lg = 0.715, lb = 0.072;
  return [
    lr + cos * (1 - lr) - sin * lr,         lg - cos * lg - sin * lg,             lb - cos * lb + sin * (1 - lb),       0, 0,
    lr - cos * lr + sin * 0.143,             lg + cos * (1 - lg) + sin * 0.140,    lb - cos * lb - sin * 0.283,          0, 0,
    lr - cos * lr - sin * (1 - lr),          lg - cos * lg + sin * lg,             lb + cos * (1 - lb) + sin * lb,       0, 0,
    0, 0, 0, 1, 0,
  ];
}

const PRESETS: Record<PresetName, number[]> = {
  // 4×5 row-major: [r-row(rgba+bias), g-row, b-row, a-row]
  'Identity':       [1,0,0,0,0,  0,1,0,0,0,  0,0,1,0,0,  0,0,0,1,0],
  // Luminance grayscale (BT.601)
  'Grayscale':      [0.299,0.587,0.114,0,0,  0.299,0.587,0.114,0,0,  0.299,0.587,0.114,0,0,  0,0,0,1,0],
  'Sepia':          [0.393,0.769,0.189,0,0,  0.349,0.686,0.168,0,0,  0.272,0.534,0.131,0,0,  0,0,0,1,0],
  'Invert':         [-1,0,0,0,1,  0,-1,0,0,1,  0,0,-1,0,1,  0,0,0,1,0],
  'Hue+90°':        hueRotate(Math.PI / 2),
  'Brightness×1.5': [1.5,0,0,0,0,  0,1.5,0,0,0,  0,0,1.5,0,0,  0,0,0,1,0],
};

const PRESET_NAMES: PresetName[] = ['Identity', 'Grayscale', 'Sepia', 'Invert', 'Hue+90°', 'Brightness×1.5'];

interface GroupConfig { id: 'outer' | 'middle' | 'inner'; preset: PresetName; offsetX: number; }

const BASE_PALETTE: { x: number; y: number; r: number; color: string }[] = [
  { x: 30,  y: 60, r: 22, color: '#ee5a4a' },
  { x: 80,  y: 60, r: 22, color: '#5ad07f' },
  { x: 130, y: 60, r: 22, color: '#4f7fff' },
];

export function ColorMatrixDemo() {
  const [groups, setGroups] = useState<GroupConfig[]>([
    { id: 'outer',  preset: 'Identity', offsetX: 0   },
    { id: 'middle', preset: 'Sepia',    offsetX: 240 },
    { id: 'inner',  preset: 'Hue+90°',  offsetX: 480 },
  ]);

  function setPreset(id: GroupConfig['id'], preset: PresetName) {
    setGroups((g) => g.map((x) => x.id === id ? { ...x, preset } : x));
  }

  const layer: RenderLayer<unknown> = useMemo(() => {
    const drawPalette = (offsetX: number): DrawCommand[] => BASE_PALETTE.map((p) => ({
      kind: 'path' as const,
      path: { kind: 'rect' as const, x: offsetX + p.x - p.r, y: p.y - p.r, width: p.r * 2, height: p.r * 2 },
      fill: { color: p.color },
    }));
    return {
      id: 'color-matrix-stack',
      label: 'Color matrix stack',
      draw: (_data, view) => {
        const outer = groups[0], middle = groups[1], inner = groups[2];
        return [{
          kind: 'group',
          transform: viewToMat3(view),
          children: [{
            kind: 'group',
            colorMatrix: PRESETS[outer.preset],
            children: [
              ...drawPalette(outer.offsetX),
              {
                kind: 'group',
                colorMatrix: PRESETS[middle.preset],
                children: [
                  ...drawPalette(middle.offsetX),
                  {
                    kind: 'group',
                    colorMatrix: PRESETS[inner.preset],
                    children: drawPalette(inner.offsetX),
                  },
                ],
              },
            ],
          }],
        }];
      },
    };
  }, [groups]);

  const scene = useScene<never, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [],
  });

  return (
    <div className="ckd-stack">
      <div style={{ position: 'relative', width: W, height: H }}>
        <SceneCanvas
          width={W}
          height={H}
          className="ckd-canvas"
          scene={scene}
          layers={{
            scene: { drawOne: () => [] },
            stack: { layer, after: 'scene' },
          }}
        />
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 24 }}>
        {groups.map((g) => (
          <PresetRow
            key={g.id}
            label={g.id}
            value={g.preset}
            onChange={(p) => setPreset(g.id, p)}
          />
        ))}
      </div>
      <small style={{ color: '#888', marginTop: 8 }}>
        Each group&apos;s color matrix multiplies into the next. Inner-group leaves see all three matrices composed.
      </small>
    </div>
  );
}

function PresetRow({
  label, value, onChange,
}: {
  label: string; value: PresetName; onChange: (p: PresetName) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <strong style={{ color: '#ddd', textTransform: 'capitalize' }}>{label}</strong>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {PRESET_NAMES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              background: value === p ? '#3a3a3a' : 'transparent',
              color: '#ddd',
              border: '1px solid #555',
              cursor: 'pointer',
            }}
          >{p}</button>
        ))}
      </div>
    </div>
  );
}
