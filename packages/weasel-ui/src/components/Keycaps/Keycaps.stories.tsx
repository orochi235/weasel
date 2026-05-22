import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactElement } from 'react';
import { KeySequence, type KeySpec, type KeySequenceProps } from './Keycaps';
import type { KeyCapVariant } from './Keycap';

const VARIANTS: KeyCapVariant[] = ['default', 'minimal'];

type Platform = 'macos' | 'windows' | 'linux';
const PLATFORMS: Platform[] = ['macos', 'windows', 'linux'];

type LegendStyle = 'symbol' | 'text';
const LEGEND_STYLES: LegendStyle[] = ['symbol', 'text'];

// Mirror of the table in Keycap.stories.tsx — kept inline rather than
// extracted so each stories file is self-contained.
const MODIFIER_LEGEND: Record<string, Record<Platform, Record<LegendStyle, string>>> = {
  '⌘': {
    macos:   { symbol: '⌘', text: 'Cmd' },
    windows: { symbol: '⊞', text: 'Win' },
    linux:   { symbol: '⊞', text: 'Super' },
  },
  '⌥': {
    macos:   { symbol: '⌥',  text: 'Option' },
    windows: { symbol: 'Alt', text: 'Alt' },
    linux:   { symbol: 'Alt', text: 'Alt' },
  },
  '⌃': {
    macos:   { symbol: '⌃',   text: 'Control' },
    windows: { symbol: 'Ctrl', text: 'Ctrl' },
    linux:   { symbol: 'Ctrl', text: 'Ctrl' },
  },
  '⇧': {
    macos:   { symbol: '⇧', text: 'Shift' },
    windows: { symbol: '⇧', text: 'Shift' },
    linux:   { symbol: '⇧', text: 'Shift' },
  },
  '⇪': {
    macos:   { symbol: '⇪', text: 'CapsLock' },
    windows: { symbol: '⇪', text: 'CapsLock' },
    linux:   { symbol: '⇪', text: 'CapsLock' },
  },
};

const KEY_LEGEND: Record<string, Record<LegendStyle, string>> = {
  '↵': { symbol: '↵', text: 'Enter' },
  '⇥': { symbol: '⇥', text: 'Tab' },
  '␣': { symbol: '␣', text: 'Space' },
  '⎋': { symbol: '⎋', text: 'Esc' },
  '⌫': { symbol: '⌫', text: 'Backspace' },
  '⌦': { symbol: '⌦', text: 'Delete' },
};

function relabel(label: string, platform: Platform, legend: LegendStyle): string {
  const mod = MODIFIER_LEGEND[label];
  if (mod) return mod[platform][legend];
  const key = KEY_LEGEND[label];
  if (key) return key[legend];
  return label;
}

function relabelKeys(keys: readonly KeySpec[] | undefined, platform: Platform, legend: LegendStyle): readonly KeySpec[] | undefined {
  return keys?.map((k) => ({ ...k, label: relabel(k.label, platform, legend) }));
}

interface StoryArgs extends KeySequenceProps {
  /** Storybook-only — substitutes every key's modifier glyph for the
   *  platform-native form. */
  platform?: Platform;
  /** Storybook-only — symbol form (⌘ / ⌥ / ↵) vs text form
   *  (Cmd / Option / Enter). */
  legend?: LegendStyle;
}

const meta: Meta<StoryArgs> = {
  title: 'weasel-ui/Foundations/Keycaps/KeySequence',
  component: KeySequence,
  args: {
    keys: [{ label: '⌘' }, { label: 'K' }],
    separator: '+',
    variant: 'default',
    platform: 'macos',
    legend: 'symbol',
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
    platform: {
      control: 'inline-radio',
      options: PLATFORMS,
      description: 'Rewrites every key\'s modifier glyph for the platform (e.g. ⌘ → Win on Windows).',
    },
    legend: {
      control: 'inline-radio',
      options: LEGEND_STYLES,
      description: '`symbol` keeps glyphs (⌘, ↵). `text` spells them out (Cmd, Enter).',
    },
    className: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'symbol', keys, ...rest }) => (
    <KeySequence {...rest} keys={relabelKeys(keys, platform, legend)} />
  ),
};
export default meta;
type Story = StoryObj<StoryArgs>;

/** Standard Cmd+K. The default separator (`+`) sits at the
 *  modifier/non-modifier boundary. */
export const Default: Story = {};

/** Empty input renders a muted em-dash placeholder. */
export const Empty: Story = {
  args: { keys: undefined },
};

/** Optional keys (`optional: true`) render with a dotted border to mark
 *  them as "may be held but isn't required." */
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
  render: ({ platform = 'macos', legend = 'symbol', keys, ...rest }) => (
    <span style={{ color: '#d4a574', fontSize: 14 }}>
      Quick action: <KeySequence {...rest} keys={relabelKeys(keys, platform, legend)} />
    </span>
  ),
};

/** Side-by-side comparison: same shortcuts in default vs minimal (under a
 *  colored container). Honors `platform` + `legend`. */
export const Gallery: Story = {
  args: { platform: 'macos', legend: 'symbol' },
  argTypes: {
    keys: { table: { disable: true } },
    separator: { table: { disable: true } },
    variant: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'symbol' }) => (
    <KeySequenceGallery platform={platform} legend={legend} />
  ),
};

function KeySequenceGallery({ platform, legend }: { platform: Platform; legend: LegendStyle }): ReactElement {
  const cases: Array<{ label: string; keys: KeySpec[] }> = [
    { label: 'Cmd+K', keys: [{ label: '⌘' }, { label: 'K' }] },
    { label: 'Cmd+Shift+P', keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'P' }] },
    { label: 'Cmd+(opt)Shift+P', keys: [{ label: '⌘' }, { label: '⇧', optional: true }, { label: 'P' }] },
    { label: 'Cmd+Enter', keys: [{ label: '⌘' }, { label: '↵' }] },
    { label: 'Esc', keys: [{ label: '⎋' }] },
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
        {cases.map((c) => {
          const keys = relabelKeys(c.keys, platform, legend) as KeySpec[] | undefined;
          return (
            <tr key={c.label}>
              <td style={cell}>{c.label}</td>
              <td style={cell}><KeySequence keys={keys} /></td>
              <td style={{ ...cell, color: '#7fb069' }}><KeySequence keys={keys} variant="minimal" /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
