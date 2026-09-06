import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { PropertyGroup } from './PropertyGroup';
import { PropertyList, PropertyPanel, SliderRow } from './PropertyPanel';

const meta: Meta<typeof PropertyGroup> = {
  title: 'weasel-ui/Properties/PropertyGroup',
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

/** `defaultCollapsed` seeds a group that keeps its own open/closed state;
 *  `collapsed` + `onCollapsedChange` hand that state to the consumer, which is
 *  how a panel remembers its sections. */
export const Collapsible: StoryObj<typeof PropertyGroup> = {
  render: () => {
    function Sections() {
      const [closed, setClosed] = useState(true);
      return (
        <PropertyPanel title="Fill">
          <PropertyList>
            <PropertyGroup title="Aqua" defaultCollapsed>
              <SliderRow label="Gloss" value={0.55} min={0} max={1} step={0.02} onChange={() => {}} />
            </PropertyGroup>
            <PropertyGroup title="Bevel" collapsed={closed} onCollapsedChange={setClosed}>
              <SliderRow label="Rings" value={32} min={4} max={96} step={1} onChange={() => {}} />
            </PropertyGroup>
          </PropertyList>
        </PropertyPanel>
      );
    }
    return <Sections />;
  },
};
