import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { CheckboxGroup, type CheckboxGroupItem } from '@weasel-js/ui/components/CheckboxGroup';

const meta: Meta<typeof CheckboxGroup> = {
  title: 'ui/CheckboxGroup',
  component: CheckboxGroup,
};

export default meta;
type Story = StoryObj<typeof CheckboxGroup>;

const OVERLAYS: readonly CheckboxGroupItem[] = ['anchors', 'handles', 'bounds', 'hit areas', 'snap targets'].map((name) => ({
  value: name,
  label: name,
}));

/** A column of checkboxes. Click one to flip it, Alt-click to show it alone, and drag across the others to set
 *  each to what the press set. */
export const Column: Story = {
  args: { 'aria-label': 'Overlays' },
  render: ({ 'aria-label': ariaLabel, disabled, readOnly }) => {
    const [value, setValue] = useState<string[]>(['anchors', 'bounds']);
    return <CheckboxGroup aria-label={ariaLabel} sweep items={OVERLAYS} value={value} onChange={setValue} disabled={disabled} readOnly={readOnly} />;
  },
};

/** Switches in a row that wraps, one disabled and one mixed. */
export const SwitchRow: Story = {
  args: { 'aria-label': 'Tools' },
  render: ({ 'aria-label': ariaLabel }) => {
    const [value, setValue] = useState<string[]>(['select', 'pen']);
    const items: CheckboxGroupItem[] = ['select', 'pen', 'shapes', 'text', 'measure'].map((name) => ({
      value: name,
      label: name,
      ...(name === 'measure' ? { disabled: true } : {}),
    }));
    return (
      <CheckboxGroup aria-label={ariaLabel} control="switch" orientation="horizontal" sweep
        items={items} value={value} mixedValues={['text']} onChange={setValue} />
    );
  },
};
