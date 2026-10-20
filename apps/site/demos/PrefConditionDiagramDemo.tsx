import { useMemo, useState } from 'react';
import { DiagramView, diagramScene } from '@weasel-js/diagram';
import type { PrefCondition, PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { PrefConditionEditor, prefConditionFlow } from '@weasel-js/ui/components/PrefConditionEditor';
import { FONT } from './diagram/shared';
import s from './PrefConditionDiagramDemo.module.css';
import { DemoStage } from './DemoStage';

const SCHEMA: PrefGroup = {
  name: 'Preferences',
  children: {
    canvas: {
      name: 'Canvas',
      children: {
        showGrid: { kind: 'boolean', name: 'Show grid', description: '', default: true },
        gridSize: { kind: 'number', name: 'Grid size', description: '', default: 8, min: 1 },
        units: {
          kind: 'enum', name: 'Units', description: '', default: 'px',
          options: [{ value: 'px', label: 'Pixels' }, { value: 'mm', label: 'Millimeters' }, { value: 'in', label: 'Inches' }],
        } as PrefLeaf,
        author: { kind: 'string', name: 'Author', description: '', default: '' } as PrefLeaf,
      },
    },
  },
};

const START: PrefCondition = {
  all: [
    { path: 'canvas.showGrid', is: true },
    { any: [
      { path: 'canvas.units', is: 'mm' },
      { path: 'canvas.gridSize', atLeast: 2, below: 64 },
    ] },
    { not: { path: 'canvas.author' } },
  ],
};

export function PrefConditionDiagramDemo() {
  const [condition, setCondition] = useState<PrefCondition | undefined>(START);
  const specs = useMemo(
    () => diagramScene(prefConditionFlow(condition, SCHEMA, { holds: 'shown' }), { font: FONT, layoutOptions: { direction: 'right' } }),
    [condition],
  );
  return (
    <div className={s.demo}>
      <PrefConditionEditor aria-label="Shown if" schema={SCHEMA} value={condition} onChange={setCondition} />
      <DemoStage width={640} height={260}>
        <DiagramView specs={specs} className="ckd-canvas" />
      </DemoStage>
    </div>
  );
}
