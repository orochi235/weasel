import { useMemo, useState } from 'react';
import { DiagramView, diagramScene, type DiagramData } from '@weasel-js/diagram';
import { FONT } from './diagram/shared';
import { DemoStage } from './DemoStage';

const STAGES = ['decode', 'filter', 'mix'] as const;

/** One row per stage, each source → effect, every effect into the one output. */
function stages(order: readonly string[]): DiagramData {
  return {
    nodes: [
      ...STAGES.flatMap((s) => [{ id: `${s}.in`, lines: [`${s} in`] }, { id: `${s}.fx`, lines: [s] }]),
      { id: 'out', lines: ['output'] },
    ],
    edges: STAGES.flatMap((s) => [{ from: `${s}.in`, to: `${s}.fx` }, { from: `${s}.fx`, to: 'out' }]),
    groups: [
      ...STAGES.map((s) => ({ id: s, members: [`${s}.in`, `${s}.fx`], label: s })),
      { id: 'stages', members: order, reorder: 'y' as const },
    ],
  };
}

export function DiagramReorderDemo() {
  const [order, setOrder] = useState<readonly string[]>(STAGES);
  const specs = useMemo(
    () => diagramScene(stages(order), { font: FONT, layoutOptions: { direction: 'right' } }),
    [order],
  );
  return (
    <DemoStage width={640} height={400}>
      <DiagramView specs={specs} className="ckd-canvas" onReorder={({ order: next }) => setOrder(next)} />
    </DemoStage>
  );
}
