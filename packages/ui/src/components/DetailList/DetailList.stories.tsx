import type { Meta, StoryObj } from '@weasel-js/forge';
import { Badge } from '../Badge';
import { Button } from '../Button';
import { Code } from '../Code';
import { KeySequence } from '../Keycaps';
import { PropertyList, PropertyRow } from '../Properties';
import { DetailList, DetailRow } from './DetailList';
import s from './DetailList.stories.module.css';

const meta: Meta<typeof DetailList> = {
  title: 'ui/DetailList',
  component: DetailList,
  args: { layout: 'inline' },
  argTypes: { layout: { control: 'inline-radio', options: ['inline', 'block'] } },
};
export default meta;
type Story = StoryObj<typeof DetailList>;

const rows = (
  <>
    <DetailRow label="id"><Code>select.collapseDeferred</Code></DetailRow>
    <DetailRow label="kind"><Badge status="accent" size="xs">action</Badge></DetailRow>
    <DetailRow label="shortcut"><KeySequence keys={[{ label: '⌘' }, { label: '⇧' }, { label: 'G' }]} /></DetailRow>
    <DetailRow label="requires">
      {['selection', 'scene', 'poseDescriptor', 'poseComposition'].map((d) => <Code key={d}>{d}</Code>)}
    </DetailRow>
    <DetailRow label="source"><Button variant="link">packages/core/src/actions/builtin/select/collapseDeferred.ts</Button></DetailRow>
    <DetailRow label="description">
      Collapses a pending multi-selection to the node under the pointer once the drag threshold is not crossed.
    </DetailRow>
  </>
);

/** Values are any run of elements; a long one wraps inside the value column. */
export const Default: Story = {
  render: (args) => <div className={s.frame}><DetailList {...args}>{rows}</DetailList></div>,
};

/** A title heads the list and names it. */
export const WithTitle: Story = {
  render: (args) => <div className={s.frame}><DetailList {...args} title="Action">{rows}</DetailList></div>,
};

/** `block` stacks each label over its value, for a column too narrow for a rail. */
export const Block: Story = {
  args: { layout: 'block' },
  render: (args) => <div className={s.narrow}><DetailList {...args}>{rows}</DetailList></div>,
};

/** `values="figures"` right-aligns each value in tabular numerals with spaces
 *  kept; a figure space (U+2007) pads a short number onto the decimal point.
 *  A status dot repeats what the value says, and an absent value holds its row
 *  with a dash. */
export const Figures: Story = {
  render: (args) => (
    <div className={s.frame}>
      <DetailList {...args} values="figures">
        <DetailRow label="Lock margin" status="success">locked +47.9°</DetailRow>
        <DetailRow label="Score">{' 0.145'}</DetailRow>
        <DetailRow label="Error" status="danger">over 12.345</DetailRow>
        <DetailRow label="Cursor" />
      </DetailList>
    </div>
  ),
};

/** One `--wzl-params-label-width` on an ancestor puts a detail list's labels and a
 *  property list's inline labels on the same rail. */
export const SharesThePropertyRail: Story = {
  render: () => (
    <div className={s.rail}>
      <DetailList title="Read-only">
        <DetailRow label="id"><Code>rect-12</Code></DetailRow>
        <DetailRow label="kind"><Badge size="xs">shape</Badge></DetailRow>
      </DetailList>
      <PropertyList>
        <PropertyRow label="Name" layout="inline"><input type="text" defaultValue="Rectangle" /></PropertyRow>
        <PropertyRow label="Opacity" layout="inline"><input type="number" defaultValue={100} /></PropertyRow>
      </PropertyList>
    </div>
  ),
};
