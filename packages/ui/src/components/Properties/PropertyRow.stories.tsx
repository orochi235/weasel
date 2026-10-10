import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyRow } from './PropertyPanel';
import { SideBySide } from './storyLayouts';

const meta: Meta<typeof PropertyRow> = {
  title: 'ui/Properties/Rows/PropertyRow',
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
  tags: ['gallery'],
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

/** The ⓘ tooltip ends with what the row reads when it is auto: under the
 *  description on a pinned row, and alone on a row with none. The second row is
 *  auto now, so its readout shows the same word. */
export const AutoValue: Story = {
  render: () => (
    // Headroom for the tooltip, which opens above its row.
    <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 80 }}>
      <PropertyRow
        label="Gap"
        layout="inline"
        description="Space between tiles, in pixels."
        autoValue="13.3333"
        onAutoChange={() => {}}
      >
        <input type="text" defaultValue="12" />
      </PropertyRow>
      <PropertyRow label="Columns" layout="inline" auto readout="auto" autoValue="4" onAutoChange={() => {}}>
        <input type="text" defaultValue="3" />
      </PropertyRow>
    </div>
  ),
};
