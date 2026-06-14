import type { Meta, StoryObj } from '@storybook/react';
import { PropertyGroup } from './PropertyGroup';
import { PropertyList, PropertyPanel, SliderRow } from './PropertyPanel';

const meta: Meta<typeof PropertyGroup> = {
  title: 'UI/Properties/PropertyGroup',
  component: PropertyGroup,
};
export default meta;

export const Basic: StoryObj<typeof PropertyGroup> = {
  render: () => (
    <PropertyPanel title="Fill">
      <PropertyList>
        <SliderRow label="Amount" value={0.6} min={0} max={1} step={0.02} onChange={() => {}} />
        <PropertyGroup title="Aqua">
          <SliderRow
            label="Light angle"
            value={270}
            min={0}
            max={359}
            step={1}
            unit="°"
            onChange={() => {}}
          />
          <SliderRow label="Gloss" value={0.55} min={0} max={1} step={0.02} onChange={() => {}} />
        </PropertyGroup>
        <PropertyGroup title="Bevel" hidden>
          <SliderRow label="Rings" value={32} min={4} max={96} step={1} onChange={() => {}} />
        </PropertyGroup>
      </PropertyList>
    </PropertyPanel>
  ),
};
