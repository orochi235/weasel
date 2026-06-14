import type { Meta, StoryObj } from '@storybook/react';
import { PropertyRow } from './PropertyPanel';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof PropertyRow> = {
  title: 'UI/Properties/Rows/PropertyRow',
  component: PropertyRow,
};
export default meta;
type Story = StoryObj<typeof PropertyRow>;

export const BothLayouts: Story = {
  render: () => (
    <SideBySide
      block={
        <PropertyRow label="Custom control">
          <input type="text" placeholder="anything goes" defaultValue="foo" />
        </PropertyRow>
      }
      inline={
        <PropertyRow label="Custom control" layout="inline">
          <input type="text" placeholder="anything goes" defaultValue="foo" />
        </PropertyRow>
      }
    />
  ),
};

export const WithReadout: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <PropertyRow label="Tempo" readout="120 bpm">
        <button type="button">Tap</button>
      </PropertyRow>
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PropertyRow label="Default" readout="42">
        <input type="text" defaultValue="hello" />
      </PropertyRow>
      <PropertyRow label="Color variant" variant="color">
        <input type="color" defaultValue="#b08adb" />
      </PropertyRow>
      <PropertyRow label="Checkbox variant" variant="checkbox">
        <input type="checkbox" defaultChecked />
      </PropertyRow>
    </div>
  ),
};
