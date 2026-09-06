import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Select, SelectItem } from './Select';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

const COLORS = [
  { value: 'r', label: 'Red' },
  { value: 'g', label: 'Green' },
  { value: 'b', label: 'Blue' },
];

export const OptionsArray: Story = {
  render: () => <Select label="Color" options={COLORS} placeholder="Pick one" />,
};

export const ExplicitChildren: Story = {
  render: () => (
    <Select label="Color" defaultSelectedKey="g">
      <SelectItem id="r">Red</SelectItem>
      <SelectItem id="g">Green</SelectItem>
      <SelectItem id="b" isDisabled>Blue (unavailable)</SelectItem>
    </Select>
  ),
};

/** The two rows differ only in `width`. `fit` takes what its widest option —
 *  "Vermilion" — needs and leaves the rest of the row to its neighbors; the
 *  default `fill` swallows the slack and squeezes them to min-content. */
export const FitWidth: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 480 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button">Add trial</button>
        <Select
          aria-label="Fits its options"
          width="fit"
          placeholder="Pick one"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button type="button">Add trial</button>
        <Select
          aria-label="Fills the row"
          placeholder="Pick one"
          options={[...COLORS, { value: 'v', label: 'Vermilion' }]}
        />
        <span>tail</span>
      </div>
    </div>
  ),
};

export const Disabled: Story = {
  render: () => <Select label="Color" options={COLORS} defaultSelectedKey="r" isDisabled />,
};

export const Controlled: Story = {
  render: () => {
    function Wrap() {
      const [v, setV] = useState<string>('r');
      return (
        <Select<string>
          label={`Color (= ${v})`}
          options={COLORS}
          selectedKey={v}
          onSelectionChange={setV}
        />
      );
    }
    return <Wrap />;
  },
};
