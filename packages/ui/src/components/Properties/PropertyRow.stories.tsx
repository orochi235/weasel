import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyRow } from '@weasel-js/ui/components/Properties';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof PropertyRow> = {
  title: 'ui/Properties/Rows/PropertyRow',
  component: PropertyRow,
};
export default meta;
type Story = StoryObj<typeof PropertyRow>;

export const BothLayouts: Story = {
  render: (args) => (
    <SideBySide
      block={
        <PropertyRow {...args} label="Custom control">
          <input type="text" placeholder="anything goes" defaultValue="foo" />
        </PropertyRow>
      }
      inline={
        <PropertyRow {...args} label="Custom control" layout="inline">
          <input type="text" placeholder="anything goes" defaultValue="foo" />
        </PropertyRow>
      }
    />
  ),
};

export const WithReadout: Story = {
  args: {
    label: 'Tempo',
    readout: '120 bpm',
    children: <button type="button">Tap</button>,
  },
  render: (args) => (
    <div style={{ width: 280 }}>
      <PropertyRow {...args} />
    </div>
  ),
};

/** A validation message sits under the control, across the row, in either layout. */
export const WithError: Story = {
  render: (args) => (
    <SideBySide
      block={
        <PropertyRow {...args} label="Name" error="needs a name">
          <input type="text" />
        </PropertyRow>
      }
      inline={
        <PropertyRow {...args} label="Name" layout="inline" error="needs a name">
          <input type="text" />
        </PropertyRow>
      }
    />
  ),
};

export const Variants: Story = {
  tags: ['gallery'],
  render: (args) => (
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PropertyRow {...args} label="Default" readout="42">
        <input type="text" defaultValue="hello" />
      </PropertyRow>
      <PropertyRow {...args} label="Color variant" variant="color">
        <input type="color" defaultValue="#b08adb" />
      </PropertyRow>
      <PropertyRow {...args} label="Checkbox variant" variant="checkbox">
        <input type="checkbox" defaultChecked />
      </PropertyRow>
    </div>
  ),
};

/** The help tooltip ends with what the row reads when it is auto: under the
 *  description on a pinned row, and alone on a row with none. The second row is
 *  auto now, so its readout shows the same word. */
export const AutoValue: Story = {
  render: (args) => (
    // Headroom for the tooltip, which opens above its row.
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 80 }}>
      <PropertyRow {...args}
        label="Gap"
        layout="inline"
        description="Space between tiles, in pixels."
        autoValue="13.3333"
        onAutoChange={() => {}}
      >
        <input type="text" defaultValue="12" />
      </PropertyRow>
      <PropertyRow {...args} label="Columns" layout="inline" auto readout="auto" autoValue="4" onAutoChange={() => {}}>
        <input type="text" defaultValue="3" />
      </PropertyRow>
    </div>
  ),
};
