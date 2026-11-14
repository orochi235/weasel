import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Disabled, ReadOnly } from '@weasel-js/ui/components/Disabled';
import { Input } from '@weasel-js/ui/components/Input';
import { Select } from '@weasel-js/ui/components/Select';
import { ToggleBar } from '@weasel-js/ui/components/ToggleBar';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';

const meta: Meta<typeof Disabled> = {
  title: 'ui/Foundations/Disabled',
  component: Disabled,
};
export default meta;

type Story = StoryObj<typeof Disabled>;

const ALIGN = [{ value: 'start', label: 'Start' }, { value: 'center', label: 'Center' }, { value: 'end', label: 'End' }];

function Controls() {
  const [align, setAlign] = useState<string | null>('start');
  return (
    <Toolbar aria-label="Controls" wrap>
      <Button>Export</Button>
      <Checkbox defaultSelected>Snap</Checkbox>
      <Input aria-label="Name" defaultValue="Layer 1" />
      <Select aria-label="Align" options={ALIGN} defaultSelectedKey="center" />
      <ToggleBar aria-label="Align" items={ALIGN} value={align} onChange={setAlign} />
    </Toolbar>
  );
}

/** No reason: every control is natively disabled, out of the tab order. */
export const NoReason: Story = { args: { when: true }, render: (args) => <Disabled {...args}><Controls /></Disabled> };

/** A reason: every control stays focusable, ignores presses, and says why. */
export const WithReason: Story = {
  args: { when: true, reason: 'The layer is locked' },
  render: (args) => <Disabled {...args}><Controls /></Disabled>,
};

/** Read-only: values stay visible and selectable, changes are refused, and action buttons still work. */
export const ReadOnlyScope: Story = {
  args: { when: true, reason: 'Shared from another document' },
  render: (args) => <ReadOnly {...args}><Controls /></ReadOnly>,
};
