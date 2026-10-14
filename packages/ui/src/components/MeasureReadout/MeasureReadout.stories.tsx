import type { Meta, StoryObj } from '@weasel-js/forge';
import {
  ActionsProvider,
  createMeasureActions,
  createMeasurementStore,
  measureBetween,
  useAction,
  type Action,
} from '@weasel-js/core';
import { useState } from 'react';
import { MeasureReadout } from './MeasureReadout';
import s from './MeasureReadout.stories.module.css';

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

/** A held measurement, with the measure tool's commands registered. Nothing
 *  is selected, so Move by and Rotate by read as unavailable. */
function Held({ from, to }: { from: { x: number; y: number }; to: { x: number; y: number } }) {
  const [store] = useState(() => {
    const made = createMeasurementStore();
    made.set(measureBetween(from, to));
    return made;
  });
  const [actions] = useState(() => createMeasureActions(store));
  return (
    <ActionsProvider>
      {actions.map((a) => <Register key={a.id} action={a} />)}
      <div className={s.stage}>
        <MeasureReadout store={store} />
      </div>
    </ActionsProvider>
  );
}

const meta: Meta<typeof Held> = {
  title: 'ui/MeasureReadout',
  component: Held,
  args: { from: { x: 10, y: 10 }, to: { x: 130, y: 60 } },
};
export default meta;

type Story = StoryObj<typeof Held>;

export const Measuring: Story = {};

/** Up and to the left: negative offsets and angle, with the minus sign. */
export const Negative: Story = {
  args: { from: { x: 300, y: 200 }, to: { x: 12.5, y: 40 } },
};
