import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ControlPanel } from './ControlPanel';
import type { ConfigField } from './types';

const meta: Meta<typeof ControlPanel> = {
  title: 'Controls/ControlPanel',
  component: ControlPanel,
  parameters: { layout: 'padded' },
};
export default meta;

type Story = StoryObj<typeof ControlPanel>;

const allFields: ConfigField[] = [
  {
    key: 'frequency',
    label: 'Frequency',
    type: 'slider',
    min: 0.1,
    max: 10,
    step: 0.1,
    default: 2,
  },
  {
    key: 'amplitude',
    label: 'Amplitude',
    type: 'slider',
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
  },
  { key: 'showGrid', label: 'Show grid', type: 'checkbox', default: true },
  {
    key: 'wave',
    label: 'Wave',
    type: 'select',
    default: 'sine',
    options: [
      { value: 'sine', label: 'Sine' },
      { value: 'square', label: 'Square' },
      { value: 'triangle', label: 'Triangle' },
    ],
  },
  { key: 'samples', label: 'Samples', type: 'number', default: 256, min: 16, max: 4096, step: 16 },
  { key: 'title', label: 'Title', type: 'text', default: 'My experiment', placeholder: 'Title…' },
  { key: 'tint', label: 'Tint', type: 'color', default: '#3a86ff' },
];

function Harness({ fields }: { fields: ConfigField[] }) {
  const initial: Record<string, unknown> = {};
  for (const f of fields) initial[f.key] = f.default;
  const [config, setConfig] = useState<Record<string, unknown>>(initial);
  return (
    <ControlPanel
      fields={fields}
      config={config}
      setConfig={(key, value) => setConfig((prev) => ({ ...prev, [key as string]: value }))}
    />
  );
}

export const Default: Story = {
  render: () => <Harness fields={allFields} />,
};

export const Minimal: Story = {
  render: () => (
    <Harness
      fields={[
        { key: 'speed', label: 'Speed', type: 'slider', min: 0, max: 10, default: 5 },
        { key: 'enabled', label: 'Enabled', type: 'checkbox', default: true },
      ]}
    />
  ),
};
