import type { Meta, StoryObj } from '@weasel-js/forge';
import {
  ActionsProvider,
  createMeasurements,
  createScene,
  DepRegistryProvider,
  measureNode,
  measurementsContribution,
  useAction,
  useDepSource,
  type Action,
  type DepName,
  type NodeId,
  type Scene,
} from '@weasel-js/core';
import { useState } from 'react';
import { MeasureReadout } from '@weasel-js/ui/components/MeasureReadout';
import s from './MeasureReadout.stories.module.css';

type AnyScene = Scene<unknown, string, unknown>;
type Pt = { x: number; y: number };

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

function Deps({ scene, selected }: { scene: AnyScene; selected: readonly string[] }) {
  useDepSource('scene' as DepName, () => scene as never);
  useDepSource('selection' as DepName, () => ({ get: () => selected, set: () => {} }) as never);
  return null;
}

/** One measurement from `from` to `to` on an annotation layer, with the
 *  measurement commands registered and `selected` as the content selection. */
function Held({ from, to, selected }: { from: Pt; to: Pt; selected: readonly string[] }) {
  const [{ scene, ms, actions }] = useState(() => {
    const sc = createScene<unknown, 'main' | 'notes', unknown>({
      systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
    }) as unknown as AnyScene;
    sc.add(measureNode('m' as NodeId, 'notes', from, to) as never);
    const m = createMeasurements({ layer: 'notes' });
    return { scene: sc, ms: m, actions: measurementsContribution(sc, m).actions ?? [] };
  });
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <Deps scene={scene} selected={selected} />
        {actions.map((a) => <Register key={a.id} action={a} />)}
        <div className={s.stage}>
          <MeasureReadout scene={scene} measurements={ms} />
        </div>
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

const meta: Meta<typeof Held> = {
  title: 'ui/MeasureReadout',
  component: Held,
  args: { from: { x: 10, y: 10 }, to: { x: 130, y: 60 }, selected: ['shape'] },
};
export default meta;

type Story = StoryObj<typeof Held>;

/** Down and to the right: the angle reads negative, clockwise below the horizontal. */
export const Measuring: Story = {};

/** Up and to the right: the angle reads positive, like a protractor, and dy is negative. */
export const Rising: Story = {
  args: { from: { x: 10, y: 200 }, to: { x: 183.2, y: 100 } },
};

/** Up and to the left: both offsets negative, with the minus sign, and an angle past 90°. */
export const Negative: Story = {
  args: { from: { x: 300, y: 200 }, to: { x: 12.5, y: 40 } },
};

/** Nothing selected: Move by and Rotate by are unavailable, and their tooltips say why. */
export const NothingSelected: Story = {
  args: { selected: [] },
};
