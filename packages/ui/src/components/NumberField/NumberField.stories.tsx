import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, type CSSProperties } from 'react';
import { NumberField } from '@weasel-js/ui/components/NumberField';

const meta: Meta<typeof NumberField> = {
  title: 'ui/Foundations/NumberField',
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
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <NumberField {...args} aria-label="Fit" width="fit" defaultValue={120} />
        <NumberField {...args}
          aria-label="Narrow fit"
          width="fit"
          hideSteppers
          defaultValue={72}
          style={{ '--wzl-number-field-width': '5ch' } as CSSProperties}
        />
        <span>tail</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <NumberField {...args} aria-label="Fills the row" defaultValue={120} />
        <span>tail</span>
      </div>
    </div>
  ),
};

/** `orientation='row'` sets the label beside the field. Filling, the field
 *  takes the rest of the row; fitted, it keeps its own width. */
export const LabelBeside: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <NumberField {...args} label="Width" orientation="row" defaultValue={120} />
      <NumberField {...args} label="Width" orientation="row" width="fit" defaultValue={120} />
      <NumberField {...args} label="Width" orientation="row" description="In document pixels." defaultValue={120} />
    </div>
  ),
};

export const Controlled: Story = {
  render: (args) => {
    const [v, setV] = useState(10);
    return <NumberField {...args} label={`Q (= ${v})`} value={v} onChange={setV} />;
  },
};
