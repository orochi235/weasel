import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactElement } from 'react';
import { KeySequence, type KeySpec } from './Keycaps';
import type { KeyCapVariant } from './Keycap';

const VARIANTS: KeyCapVariant[] = ['default', 'minimal'];

const meta: Meta<typeof KeySequence> = {
  title: 'weasel-ui/Foundations/Keycaps/KeySequence',
  component: KeySequence,
  args: {
    keys: [{ label: '⌘' }, { label: 'K' }],
    separator: '+',
    variant: 'default',
  },
  argTypes: {
    keys: {
      control: 'object',
      description:
        '`KeySpec[]` — `{ label, optional? }`. Modifiers always render first regardless of input order; relative order within each group is preserved.',
    },
    separator: {
      control: 'text',
      description:
        'Inserted between the trailing modifier chip and the first non-modifier chip. `null` or `""` suppresses it.',
    },
    variant: {
      control: 'inline-radio',
      options: VARIANTS,
      description: 'Forwarded to every contained `KeyCap`.',
    },
    className: { table: { disable: true } },
  },
};
export default meta;
type Story = StoryObj<typeof KeySequence>;

/** Standard Cmd+K. The default separator (`+`) sits at the
 *  modifier/non-modifier boundary. */
export const Default: Story = {};

/** Empty input renders a muted em-dash placeholder. */
export const Empty: Story = {
  args: { keys: undefined },
};

/** Optional keys (`optional: true`) render inverted to mark them as
 *  "may be held but isn't required." */
export const WithOptional: Story = {
  args: {
    keys: [
      { label: '⌘' },
      { label: '⇧', optional: true },
      { label: 'P' },
    ],
  },
};

/** Multi-modifier sequence — modifiers always sort first; relative order
 *  within each group is preserved from input. */
export const MultiModifier: Story = {
  args: {
    keys: [
      { label: 'A' },
      { label: '⌥' },
      { label: 'B' },
      { label: '⌘' },
    ],
    separator: '+',
  },
};

/** A `then`-style separator for two-step (chord) sequences. */
export const CustomSeparator: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: 'K' }],
    separator: ' then ',
  },
};

/** No separator at all — chips abut. */
export const NoSeparator: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: 'K' }],
    separator: null,
  },
};

/** Minimal variant — every chip uses `currentColor`. Useful next to
 *  badges / colored text in tables. */
export const Minimal: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'P' }],
    variant: 'minimal',
  },
  render: (args) => (
    <span style={{ color: '#d4a574', fontSize: 14 }}>
      Quick action: <KeySequence {...args} />
    </span>
  ),
};

/** Side-by-side comparison: same shortcuts in default vs minimal (under a
 *  colored container) plus an optional-modifier case. */
export const Gallery: Story = {
  parameters: { controls: { disable: true } },
  render: () => <KeySequenceGallery />,
};

function KeySequenceGallery(): ReactElement {
  const cases: Array<{ label: string; keys: KeySpec[] }> = [
    { label: 'Cmd+K', keys: [{ label: '⌘' }, { label: 'K' }] },
    { label: 'Cmd+Shift+P', keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'P' }] },
    { label: 'Cmd+(opt)Shift+P', keys: [{ label: '⌘' }, { label: '⇧', optional: true }, { label: 'P' }] },
    { label: 'Cmd+Enter', keys: [{ label: '⌘' }, { label: '↵' }] },
    { label: 'Esc', keys: [{ label: 'Esc' }] },
  ];
  const cell: CSSProperties = {
    padding: '6px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    textAlign: 'left',
    verticalAlign: 'middle',
  };
  return (
    <table style={{ borderCollapse: 'collapse', fontFamily: 'system-ui, sans-serif', fontSize: 13, color: '#d4c4a8' }}>
      <thead>
        <tr>
          <th style={cell}>case</th>
          <th style={cell}>default</th>
          <th style={cell}>minimal (in colored text)</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => (
          <tr key={c.label}>
            <td style={cell}>{c.label}</td>
            <td style={cell}><KeySequence keys={c.keys} /></td>
            <td style={{ ...cell, color: '#7fb069' }}><KeySequence keys={c.keys} variant="minimal" /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
