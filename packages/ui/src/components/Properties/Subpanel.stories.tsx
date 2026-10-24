import type { Meta, StoryObj } from '@weasel-js/forge';
import { stereo } from '@weasel-js/ui/components/MotifFrame';
import { PropertyField, PropertyList, PropertyPanel, Subpanel } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof Subpanel> = {
  title: 'ui/Properties/Subpanel',
  component: Subpanel,
};
export default meta;
type Story = StoryObj<typeof Subpanel>;

/** A titled divider over the rows that belong to one part of a panel. */
export const Basic: Story = {
  args: { title: 'Bubbles' },
  render: (args) => (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Tail">
        <PropertyList>
          <PropertyField kind="number" control="slider" label="Length" value={60} min={8} max={220} unit="px" onChange={() => {}} />
          <Subpanel {...args}>
            <PropertyField kind="number" control="slider" label="Size" value={30} min={8} max={120} unit="px" onChange={() => {}} />
            <PropertyField kind="number" control="slider" label="Count" value={3} min={1} max={8} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

/** In a paired list the subpanel spans both columns, and its own rows pair up. */
export const InPairs: Story = {
  args: { title: 'Bubbles' },
  render: (args) => (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Tail">
        <PropertyList pack="pairs">
          <PropertyField kind="number" control="slider" label="Angle" value={115} min={0} max={359} unit="°" onChange={() => {}} />
          <PropertyField kind="number" control="slider" label="Bend" value={0} min={-1} max={1} step={0.02} onChange={() => {}} />
          <Subpanel {...args}>
            <PropertyField kind="number" control="slider" label="Size" value={30} min={8} max={120} unit="px" onChange={() => {}} />
            <PropertyField kind="number" control="slider" label="Count" value={3} min={1} max={8} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

/** A stance, grade or tint colors the title and the rule. */
export const Tinted: Story = {
  render: () => (
    <div style={{ width: 320 }}>
      <PropertyPanel title="Stances">
        <PropertyList>
          <Subpanel title="Tint 0" tint={0}>
            <PropertyField kind="number" control="slider" label="Amount" value={0.5} min={0} max={1} step={0.05} onChange={() => {}} />
          </Subpanel>
          <Subpanel title="Advanced" stance="advanced">
            <PropertyField kind="number" control="slider" label="Amount" value={0.5} min={0} max={1} step={0.05} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

/** Two tinted panels that fold from the twisty before their titles, the second
 *  starting folded, and a subpanel inside the first that folds on its own. */
export const Collapsible: Story = {
  args: { title: 'Bubbles', collapsible: true },
  render: (args) => (
    <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PropertyPanel title="Tail" stance="clarify" tint={0} collapsible>
        <PropertyList pack="pairs">
          <PropertyField kind="number" control="slider" label="Angle" value={115} min={0} max={359} unit="°" onChange={() => {}} />
          <PropertyField kind="number" control="slider" label="Bend" value={0} min={-1} max={1} step={0.02} onChange={() => {}} />
          <Subpanel {...args}>
            <PropertyField kind="number" control="slider" label="Size" value={30} min={8} max={120} unit="px" onChange={() => {}} />
            <PropertyField kind="number" control="slider" label="Count" value={3} min={1} max={8} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
      <PropertyPanel title="Code" stance="clarify" tint={2} defaultCollapsed>
        <PropertyList>
          <PropertyField kind="number" control="slider" label="Size" value={12} min={6} max={32} unit="px" onChange={() => {}} />
        </PropertyList>
      </PropertyPanel>
    </div>
  ),
};

/** Drawn in another motif, the subpanel keeps its place in the list's grid. */
export const InAMotif: Story = {
  args: { title: 'Bubbles', motif: stereo({ side: 'top' }), tint: 2 },
  render: Basic.render,
};
