import { useState } from 'react';
import { DrawCanvas } from '@weasel-js/core';
import type { DrawCommand } from '@weasel-js/renderer';
import { Field } from '@weasel-js/ui/components/Field';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { DemoStage } from './DemoStage';
import s from './ColorMatrixDemo.module.css';

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

type GroupId = 'outer' | 'middle' | 'inner';
const GROUPS: GroupId[] = ['outer', 'middle', 'inner'];
/** Where each group's copy of the palette sits. */
const OFFSET_X: Record<GroupId, number> = { outer: 0, middle: 240, inner: 480 };

const BASE_PALETTE: { x: number; y: number; r: number; color: string }[] = [
  { x: 30,  y: 60, r: 22, color: '#ee5a4a' },
  { x: 80,  y: 60, r: 22, color: '#5ad07f' },
  { x: 130, y: 60, r: 22, color: '#4f7fff' },
];

const drawPalette = (offsetX: number): DrawCommand[] => BASE_PALETTE.map((p) => ({
  kind: 'path',
  path: { kind: 'rect', x: offsetX + p.x - p.r, y: p.y - p.r, width: p.r * 2, height: p.r * 2 },
  fill: { paint: { color: p.color } },
}));

/** Each group holds its own palette and the next group in, so the innermost sees all three matrices. */
function stack(presets: Record<GroupId, PresetName>, depth = 0): DrawCommand[] {
  const id = GROUPS[depth];
  if (!id) return [];
  return [{
    kind: 'group',
    colorMatrix: PRESETS[presets[id]],
    children: [...drawPalette(OFFSET_X[id]), ...stack(presets, depth + 1)],
  }];
}

export function ColorMatrixDemo() {
  const [presets, setPresets] = useState<Record<GroupId, PresetName>>({ outer: 'Identity', middle: 'Sepia', inner: 'Hue+90°' });

  return (
    <div className="ckd-demo">
      <DemoStage width={W} height={H}>
        <DrawCanvas className="ckd-canvas" draw={stack(presets)} />
      </DemoStage>
      <div className={s.rows}>
        {GROUPS.map((id) => (
          <Field key={id} label={<strong className={s.label}>{id}</strong>}>
            <SegmentedBar
              items={PRESET_NAMES.map((p) => ({ value: p, label: p }))}
              value={presets[id]}
              onChange={(p) => p && setPresets((was) => ({ ...was, [id]: p }))}
              size="sm"
            />
          </Field>
        ))}
      </div>
      <p className="ckd-hint">
        Each group&apos;s color matrix multiplies into the next. Inner-group leaves see all three matrices composed.
      </p>
    </div>
  );
}
