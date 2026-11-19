import { useState } from 'react';
import { DrawCanvas } from '@weasel-js/core';
import { starPath } from '@weasel-js/geom';
import { commandPaint, type DrawCommand } from '@weasel-js/renderer';
import type { Paint } from '@weasel-js/paint';
import { getPaintKind } from '@weasel-js/paint-kinds';
import { usePaintKind, usePaintKinds } from '@weasel-js/paint-kinds/react';
import { Button } from '@weasel-js/ui/components/Button';
import { SegmentedBar } from '@weasel-js/ui/components/Segmented';
import { Select } from '@weasel-js/ui/components/Select';
import { DemoStage } from './DemoStage';
import s from './PaintKindsDemo.module.css';

const W = 480, H = 260;
const MESH = 'mesh-gradient';
const SQUARE = { x: 32, y: 30, width: 200, height: 200 };
const STAR_BOX = { x: 256, y: 26, width: 208, height: 208 };

/** A square and a star, each filled with `paint` laid over its own box. */
function swatches(paint: Paint): DrawCommand[] {
  const fill = (box: typeof SQUARE) => commandPaint(paint, box) ?? undefined;
  return [
    { kind: 'path', path: { kind: 'rect', ...SQUARE }, fill: { paint: fill(SQUARE) } },
    { kind: 'path', path: starPath({ x: 360, y: 130 }, 104, 5, 46, -Math.PI / 2), fill: { paint: fill(STAR_BOX) } },
  ];
}

const COLORS = ['#3a7bd5', '#c0392b', '#7fb069'].map((c) => ({ value: c, label: c }));

export function PaintKindsDemo() {
  const kinds = usePaintKinds();
  const [kind, setKind] = useState('linear-gradient');
  const [color, setColor] = useState(COLORS[0]!.value);
  const entry = usePaintKind(kind);
  const mesh = kinds.some((k) => k.id === MESH);
  const paint = entry?.seed(color);

  return (
    <div className={s.demo}>
      <div className="ckd-toolbar">
        <Select
          label="kind" orientation="row" width="fit"
          options={kinds.map((k) => ({ value: k.id, label: k.label }))}
          selectedKey={kind} onSelectionChange={setKind}
        />
        <SegmentedBar items={COLORS} value={color} onChange={(v) => v && setColor(v)} aria-label="Seed color" size="sm" />
        <Button onClick={() => getPaintKind(MESH)} disabled={mesh}>Load mesh gradient</Button>
      </div>
      <DemoStage width={W} height={H}>
        <DrawCanvas
          className="ckd-canvas"
          background={{ kind: 'solid', color: '#ffffff' }}
          draw={paint ? swatches(paint) : []}
        />
      </DemoStage>
      {entry && paint && (
        <dl className={s.facts}>
          <dt>family</dt><dd>{entry.family?.label ?? 'none'}</dd>
          <dt>gradient</dt><dd>{entry.stopsOf && entry.fromStops ? 'yes' : 'no'}</dd>
          <dt>colorOf</dt><dd><code>{entry.colorOf(paint) ?? 'undefined'}</code></dd>
        </dl>
      )}
    </div>
  );
}
