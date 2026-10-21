import type { Meta, StoryObj } from '@weasel-js/forge';
import type { ReactElement } from 'react';
import { KeyBank, type KeyBankProps, KeyCap, KEY_MIN_SCALE } from '@weasel-js/ui/components/Keycaps';
import { FONT_OPTIONS, resolveFont } from './keycapStoryFonts';

interface StoryArgs extends KeyBankProps {
  /** Story-only: each key's width, in key heights. */
  keyWidth?: number;
  /** Story-only: font preset or font-family forwarded to every key. */
  font?: string;
}

const NAV = ['PrtSc', 'ScrLk', 'Pause', 'Insert', 'Home', 'PgUp', 'Delete', 'End', 'PgDn'];

const meta: Meta<StoryArgs> = {
  title: 'ui/Foundations/Keycaps/KeyBank',
  component: KeyBank,
  args: { wrap: false, minScale: KEY_MIN_SCALE, keyWidth: 1, font: 'system sans' },
  argTypes: {
    wrap: { control: 'boolean', description: 'Lets a key print a two-line spelling instead of shrinking.' },
    minScale: { control: { type: 'range', min: 0.3, max: 1, step: 0.05 } },
    keyWidth: { control: { type: 'range', min: 1, max: 3, step: 0.25 } },
    font: { control: 'select', options: FONT_OPTIONS },
    spellings: { table: { disable: true } },
    className: { table: { disable: true } },
    children: { table: { disable: true } },
  },
  render: (args) => <Cluster {...args} />,
};
export default meta;
type Story = StoryObj<StoryArgs>;

/** A navigation cluster in one bank: every legend prints at the size the
 *  widest one needs, picking a shorter spelling (Ins, Del) where one fits. */
export const Default: Story = {};

/** The same cluster with `wrap` on: a key that would shrink prints a
 *  two-line spelling instead and sizes itself, while the rest still share one
 *  size. */
export const Wrapped: Story = {
  args: { wrap: true },
};

/** The bank beside the same keys outside any bank, which are never fitted. */
export const BankedAndLoose: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 24 }}>
      <Cluster {...args} />
      <Cluster {...args} loose />
    </div>
  ),
};

function Cluster({ keyWidth = 1, font, loose, ...bank }: StoryArgs & { loose?: boolean }): ReactElement {
  const width = `calc(${keyWidth} * var(--wzl-control-h-xs))`;
  const keys = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${width})`, gap: 3 }}>
      {NAV.map((k) => (
        <KeyCap key={k} label={k} font={resolveFont(font)} style={{ width, minWidth: 0, padding: '0 2px' }} />
      ))}
    </div>
  );
  return loose ? keys : <KeyBank {...bank}>{keys}</KeyBank>;
}
