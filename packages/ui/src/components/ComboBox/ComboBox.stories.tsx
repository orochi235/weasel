import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ComboBox, ComboBoxItem } from './ComboBox';

const meta: Meta<typeof ComboBox> = {
  title: 'Primitives/ComboBox',
  component: ComboBox,
};
export default meta;

type Story = StoryObj<typeof ComboBox>;

const COLORS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
  { value: 'k', label: 'Black' },
  { value: 'w', label: 'White' },
];

export const OptionsArray: Story = {
  render: () => <ComboBox label="Color" options={COLORS} placeholder="Type to filter…" />,
};

export const ExplicitChildren: Story = {
  render: () => (
    <ComboBox label="Color" defaultSelectedKey="g">
      <ComboBoxItem id="r">Red</ComboBoxItem>
      <ComboBoxItem id="g">Green</ComboBoxItem>
      <ComboBoxItem id="b" isDisabled>Blue (unavailable)</ComboBoxItem>
    </ComboBox>
  ),
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState<string | null>('r');
      return (
        <ComboBox<string>
          label={`Color (= ${v ?? '∅'})`}
          options={COLORS}
          selectedKey={v}
          onSelectionChange={setV}
        />
      );
    }
    return <Wrap />;
  },
};

/** The two rows differ only in `width`. `fit` takes what its widest option —
 *  "Vermilion" — needs and leaves the rest of the row to its neighbors; the
 *  default `fill` swallows the slack and squeezes them to min-content. */
export const FitWidth: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button">Add trial</button>
        <ComboBox
          aria-label="Fits its options"
          width="fit"
          placeholder="Filter…"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button">Add trial</button>
        <ComboBox
          aria-label="Fills the row"
          placeholder="Filter…"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
    </div>
  ),
};
