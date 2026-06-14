import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { OptionsBar, type OptionsBarItem } from './OptionsBar';

const meta: Meta<typeof OptionsBar> = {
  title: 'weasel-ui/Foundations/OptionsBar',
  component: OptionsBar,
};

export default meta;
type Story = StoryObj<typeof OptionsBar>;

export const Independent: Story = {
  render: () => {
    const [b, setB] = useState(true);
    const [i, setI] = useState(false);
    const [u, setU] = useState(false);
    const items: OptionsBarItem[] = [
      { value: 'b', label: 'B', selected: b, onChange: setB },
      { value: 'i', label: 'I', selected: i, onChange: setI },
      { value: 'u', label: 'U', selected: u, onChange: setU },
    ];
    return <OptionsBar items={items} ariaLabel="Text style" />;
  },
};

export const Minimal: Story = {
  render: () => {
    const [b, setB] = useState(true);
    const [i, setI] = useState(false);
    const [u, setU] = useState(true);
    const items: OptionsBarItem[] = [
      { value: 'b', label: 'B', selected: b, onChange: setB },
      { value: 'i', label: 'I', selected: i, onChange: setI },
      { value: 'u', label: 'U', selected: u, onChange: setU },
    ];
    return <OptionsBar items={items} variant="minimal" />;
  },
};

export const Disabled: Story = {
  render: () => {
    const [a, setA] = useState(true);
    const [c, setC] = useState(false);
    const items: OptionsBarItem[] = [
      { value: 'a', label: 'A', selected: a, onChange: setA },
      { value: 'b', label: 'B', selected: false, onChange: () => {}, disabled: true },
      { value: 'c', label: 'C', selected: c, onChange: setC },
    ];
    return <OptionsBar items={items} />;
  },
};
