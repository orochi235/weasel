import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { DialogRow, PropertyField, PropertyList, RowScope } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof RowScope> = {
  title: 'ui/Properties/Rows/RowScope',
  component: RowScope,
};
export default meta;

type Story = StoryObj<typeof RowScope>;

/** One scope's state, drawn by whichever row is inside it: a field's and a dialog row's. */
export const Default: Story = {
  args: { changed: true, error: 'Out of range' },
  render: function Render(args) {
    const [gap, setGap] = useState(12);
    const [auto, setAuto] = useState(true);
    return (
      <PropertyList>
        <RowScope {...args} auto={auto} onAutoChange={setAuto} autoValue="18" onReset={() => setGap(12)}>
          <PropertyField kind="number" label="Gap" value={gap} onChange={setGap} readout={auto ? 'auto' : undefined} />
        </RowScope>
        <RowScope {...args}>
          <DialogRow label="Globs" summary="src/**/*.ts">
            {() => <p>The globs</p>}
          </DialogRow>
        </RowScope>
      </PropertyList>
    );
  },
};
