import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { OptionsBar, type OptionsBarItem } from '@weasel-js/ui/components/OptionsBar';

const meta: Meta<typeof OptionsBar> = {
  title: 'ui/Foundations/OptionsBar',
  component: OptionsBar,
};

export default meta;
type Story = StoryObj<typeof OptionsBar>;

export const Independent: Story = {
  args: { ariaLabel: 'Text style' },
  render: (args) => {
    const [b, setB] = useState(true);
    const [i, setI] = useState(false);
    const [u, setU] = useState(false);
    const items: OptionsBarItem[] = [
      { value: 'b', label: 'B', selected: b, onChange: setB },
      { value: 'i', label: 'I', selected: i, onChange: setI },
      { value: 'u', label: 'U', selected: u, onChange: setU },
    ];
    return <OptionsBar {...args} items={items} />;
  },
};

export const Minimal: Story = {
  args: { variant: 'minimal' },
  render: (args) => {
    const [b, setB] = useState(true);
    const [i, setI] = useState(false);
    const [u, setU] = useState(true);
    const items: OptionsBarItem[] = [
      { value: 'b', label: 'B', selected: b, onChange: setB },
      { value: 'i', label: 'I', selected: i, onChange: setI },
      { value: 'u', label: 'U', selected: u, onChange: setU },
    ];
    return <OptionsBar {...args} items={items} />;
  },
};

export const Disabled: Story = {
  render: (args) => {
    const [a, setA] = useState(true);
    const [c, setC] = useState(false);
    const items: OptionsBarItem[] = [
      { value: 'a', label: 'A', selected: a, onChange: setA },
      { value: 'b', label: 'B', selected: false, onChange: () => {}, disabled: true },
      { value: 'c', label: 'C', selected: c, onChange: setC },
    ];
    return <OptionsBar {...args} items={items} />;
  },
};
