import { useMemo, useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import type { LastOperation, LastOperationStore } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { LastOperationPanel, type LastOperationPanelProps } from '@weasel-js/ui/components/LastOperationPanel';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof LastOperationPanel> = {
  title: 'ui/Foundations/LastOperationPanel',
  component: LastOperationPanel,
};
export default meta;

type Story = StoryObj<typeof LastOperationPanel>;

const RESAMPLE: LastOperation = {
  id: 'resamplePath',
  label: 'Resample',
  schema: pref.group('Resample', {
    count: pref.number('Anchors', 12, { min: 0, max: 200, step: 1 }),
    keepCorners: pref.boolean('Keep corners', true),
    tolerance: pref.number('Tolerance', 0.5, { min: 0.05, max: 5, step: 0.05, control: 'slider' }),
  }),
  values: { count: 12, keepCorners: true, tolerance: 0.5 },
};

/** A store holding one operation, as a canvas's actions tree would after Resample ran. */
function useStoryStore(): { store: LastOperationStore; rerun: () => void } {
  const [op, setOp] = useState<LastOperation | null>(RESAMPLE);
  return useMemo(() => ({
    store: {
      get: () => op,
      subscribe: () => () => {},
      adjust: (patch) => {
        setOp((was) => (was ? { ...was, values: { ...was.values, ...patch } } : was));
        return true;
      },
      dismiss: () => setOp(null),
    },
    rerun: () => setOp(RESAMPLE),
  }), [op]);
}

/** The panel after Resample: each change of a field is an adjustment of the command just run. The close button
 *  dismisses it, and the button below brings it back. */
export const AfterACommand: Story = {
  args: { closeLabel: 'Close' },
  render: function AfterACommandStory(args: LastOperationPanelProps) {
    const { store, rerun } = useStoryStore();
    return (
      <>
        <LastOperationPanel {...args} store={store} />
        {store.get() === null && <Button size="sm" onClick={rerun}>Run Resample again</Button>}
      </>
    );
  },
};
