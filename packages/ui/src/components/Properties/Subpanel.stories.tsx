import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyList, PropertyPanel, SliderRow } from './PropertyPanel';
import { Subpanel } from './Subpanel';

const meta: Meta<typeof Subpanel> = {
  title: 'weasel-ui/Properties/Subpanel',
  component: Subpanel,
};
export default meta;
type Story = StoryObj<typeof Subpanel>;

/** A titled divider over the rows that belong to one part of a panel. */
export const Basic: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Tail">
        <PropertyList>
          <SliderRow label="Length" value={60} min={8} max={220} unit="px" onChange={() => {}} />
          <Subpanel title="Bubbles">
            <SliderRow label="Size" value={30} min={8} max={120} unit="px" onChange={() => {}} />
            <SliderRow label="Count" value={3} min={1} max={8} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

/** In a paired list the subpanel spans both columns, and its own rows pair up. */
export const InPairs: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Tail">
        <PropertyList pack="pairs">
          <SliderRow label="Angle" value={115} min={0} max={359} unit="°" onChange={() => {}} />
          <SliderRow label="Bend" value={0} min={-1} max={1} step={0.02} onChange={() => {}} />
          <Subpanel title="Bubbles">
            <SliderRow label="Size" value={30} min={8} max={120} unit="px" onChange={() => {}} />
            <SliderRow label="Count" value={3} min={1} max={8} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

/** A stance or a tone colors the title and the rule. */
export const Toned: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Stances">
        <PropertyList>
          <Subpanel title="Tone 0" tone={0}>
            <SliderRow label="Amount" value={0.5} min={0} max={1} step={0.05} onChange={() => {}} />
          </Subpanel>
          <Subpanel title="Advanced" stance="advanced">
            <SliderRow label="Amount" value={0.5} min={0} max={1} step={0.05} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};
