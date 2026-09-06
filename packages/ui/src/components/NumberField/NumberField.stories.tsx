import type { Meta, StoryObj } from '@storybook/react';
import { useState, type CSSProperties } from 'react';
import { NumberField } from './NumberField';

const meta: Meta<typeof NumberField> = {
  title: 'Primitives/NumberField',
  component: NumberField,
};
export default meta;

type Story = StoryObj<typeof NumberField>;

export const Basic: Story = { args: { label: 'Width', defaultValue: 120 } };
export const MinMaxStep: Story = { args: { label: 'Opacity', minValue: 0, maxValue: 100, step: 5, defaultValue: 80 } };
export const HideSteppers: Story = { args: { label: 'Count', hideSteppers: true, defaultValue: 1 } };
export const Disabled: Story = { args: { label: 'Locked', isDisabled: true, defaultValue: 50 } };

/** `fit` sizes to a character count instead of the input's 20-character
 *  default; the second field narrows that count through
 *  `--wzl-number-field-width`. The third is the default `fill`. */
export const FitWidth: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <NumberField aria-label="Fit" width="fit" defaultValue={120} />
        <NumberField
          aria-label="Narrow fit"
          width="fit"
          hideSteppers
          defaultValue={72}
          style={{ '--wzl-number-field-width': '5ch' } as CSSProperties}
        />
        <span>tail</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <NumberField aria-label="Fills the row" defaultValue={120} />
        <span>tail</span>
      </div>
    </div>
  ),
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState(10);
      return <NumberField label={`Q (= ${v})`} value={v} onChange={setV} />;
    }
    return <Wrap />;
  },
};
