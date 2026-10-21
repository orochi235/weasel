import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { CloseButton } from '@weasel-js/ui/components/CloseButton';
import { DragGrip } from '@weasel-js/ui/components/DragGrip';
import { PropertyGroup, PropertyField, PropertyList, PropertyPanel, Subpanel } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof PropertyGroup> = {
  title: 'ui/Properties/PropertyGroup',
  component: PropertyGroup,
};
export default meta;

export const Basic: StoryObj<typeof PropertyGroup> = {
  args: { title: 'Aqua' },
  render: (args) => (
    <PropertyPanel title="Fill">
      <PropertyList>
        <PropertyField kind="number" control="slider" label="Amount" value={0.6} min={0} max={1} step={0.02} onChange={() => {}} />
        <PropertyGroup {...args}>
          <PropertyField
            kind="number"
            control="slider"
            label="Light angle"
            value={270}
            min={0}
            max={359}
            step={1}
            unit="°"
            onChange={() => {}}
          />
          <PropertyField kind="number" control="slider" label="Gloss" value={0.55} min={0} max={1} step={0.02} onChange={() => {}} />
        </PropertyGroup>
        <PropertyGroup title="Bevel" hidden>
          <PropertyField kind="number" control="slider" label="Rings" value={32} min={4} max={96} step={1} onChange={() => {}} />
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
              <PropertyField kind="number" control="slider" label="Gloss" value={0.55} min={0} max={1} step={0.02} onChange={() => {}} />
            </PropertyGroup>
            <PropertyGroup title="Bevel" collapsed={closed} onCollapsedChange={setClosed}>
              <PropertyField kind="number" control="slider" label="Rings" value={32} min={4} max={96} step={1} onChange={() => {}} />
            </PropertyGroup>
          </PropertyList>
        </PropertyPanel>
      );
    }
    return <Sections />;
  },
};

/** `twisty="folded"` shows a container's twisty only while it is folded: open, a press on the title folds it, and
 *  the twisty comes back under keyboard focus. Bevel and Noise start folded, so theirs show. */
export const FoldedTwisty: StoryObj<typeof PropertyGroup> = {
  render: () => (
    <>
      <PropertyPanel title="Fill" twisty="folded" collapsible>
        <PropertyList>
          <PropertyGroup title="Aqua" twisty="folded" collapsible>
            <PropertyField kind="number" control="slider" label="Gloss" value={0.55} min={0} max={1} step={0.02} onChange={() => {}} />
          </PropertyGroup>
          <PropertyGroup title="Bevel" twisty="folded" defaultCollapsed>
            <PropertyField kind="number" control="slider" label="Rings" value={32} min={4} max={96} step={1} onChange={() => {}} />
          </PropertyGroup>
          <Subpanel title="Grain" twisty="folded" collapsible>
            <PropertyField kind="number" control="slider" label="Amount" value={0.2} min={0} max={1} step={0.02} onChange={() => {}} />
          </Subpanel>
          <Subpanel title="Noise" twisty="folded" defaultCollapsed>
            <PropertyField kind="number" control="slider" label="Scale" value={4} min={1} max={16} step={1} onChange={() => {}} />
          </Subpanel>
        </PropertyList>
      </PropertyPanel>
      <PropertyPanel title="Stroke" twisty="folded" defaultCollapsed>
        <PropertyField kind="number" control="slider" label="Width" value={2} min={0} max={16} step={1} onChange={() => {}} />
      </PropertyPanel>
    </>
  ),
};

/** `leading` and `actions` share the title row with the title: a handle before it, a value and a remove button after
 *  it. A tone draws the group's edge in it, which tells like groups in a list apart. */
export const HeaderSlots: StoryObj<typeof PropertyGroup> = {
  render: () => (
    <PropertyPanel title="Effects">
      <PropertyList>
        {(['Glow', 'Drop shadow'] as const).map((name, i) => (
          <PropertyGroup
            key={name}
            title={name}
            tone={i}
            collapsible
            leading={<DragGrip />}
            actions={
              <CloseButton ariaLabel={`Remove ${name}`} />
            }
          >
            <PropertyField kind="number" control="slider" label="Size" value={8} min={0} max={32} unit="px" onChange={() => {}} />
          </PropertyGroup>
        ))}
      </PropertyList>
    </PropertyPanel>
  ),
};
