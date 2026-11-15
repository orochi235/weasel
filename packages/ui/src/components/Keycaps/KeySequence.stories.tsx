import type { Meta, StoryObj } from '@weasel-js/forge';
import type { ReactElement } from 'react';
import { KeySequence, type KeyLegend, type KeySequenceProps, type KeyCapVariant, KEYCAP_VARIANT_ICONS } from '@weasel-js/ui/components/Keycaps';
import { keyLegendsFromShortcut, type LegendStyle, type Platform } from '@weasel-js/gestures';
import { FONT_OPTIONS, resolveFont } from './keycapStoryFonts';
import { relabelKeys } from './keycapStoryLegends';
import s from './Keycaps.stories.module.css';

const VARIANTS: KeyCapVariant[] = ['default', 'inverse'];
const PLATFORMS: Platform[] = ['macos', 'windows', 'linux'];
const LEGEND_STYLES: LegendStyle[] = ['auto', 'symbol', 'text'];

interface StoryArgs extends KeySequenceProps {
  /** Story-only — substitutes every key's modifier glyph for the
   *  platform-native form. */
  platform?: Platform;
  /** Story-only — symbol form (⌘ / ⌥ / ↵) vs text form
   *  (Cmd / Option / Enter). */
  legend?: LegendStyle;
}

const meta: Meta<StoryArgs> = {
  title: 'ui/Keycaps/KeySequence',
  component: KeySequence,
  args: {
    keys: [{ label: '⌘' }, { label: 'K' }],
    separator: '+',
    joins: 'key',
    variant: 'default',
    platform: 'macos',
    legend: 'auto',
    font: 'system sans',
  },
  argTypes: {
    keys: {
      control: 'object',
      description:
        '`KeyLegend[]` — `{ label, optional? }`. Modifiers always render first regardless of input order; relative order within each group is preserved.',
    },
    separator: {
      control: 'text',
      description:
        'Glyph drawn wherever `joins` places a separator.',
    },
    joins: {
      control: 'inline-radio',
      options: ['all', 'key', 'none'],
      description:
        '`all`: between every pair of chips. `key` (default): once, between the last modifier and the first non-modifier. `none`: never.',
    },
    variant: {
      control: { type: 'inline-radio', icons: KEYCAP_VARIANT_ICONS },
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
      description: '`auto` (default): per-entry per-platform label. `symbol` / `text` force a specific form.',
    },
    font: {
      control: 'select',
      options: FONT_OPTIONS,
      description: 'Forwarded to every KeyCap. Defaults to system sans (the chip\'s native stack).',
    },
    className: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'auto', keys, font, ...rest }) => (
    <KeySequence {...rest} keys={relabelKeys(keys, platform, legend)} font={resolveFont(font)} />
  ),
};
export default meta;
type Story = StoryObj<StoryArgs>;

/** Standard Cmd+K. By default (`joins: 'key'`) a separator sits before
 *  each non-modifier key. */
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

/** A kit shortcut (`{ key, mod, shift, alt }`) through `keyLegendsFromShortcut`,
 *  which spells it for the platform: this one is pinned to Windows. */
export const FromShortcut: Story = {
  args: {
    keys: keyLegendsFromShortcut({ key: 'z', mod: true, shift: 'optional' }, { platform: 'windows' }),
  },
};

/** A key inside a keymap, after the keymaps that lead to it: `formatShortcutParts`
 *  gives the `leader` and the `keys`. */
export const InKeymap: Story = {
  args: {
    leader: [{ label: 'View' }, { label: 'Loupe' }],
    keys: [{ label: '⌘' }, { label: '2' }],
    joins: 'none',
  },
};

/** A `then`-style separator for two-step (chord) sequences. */
export const CustomSeparator: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: 'K' }],
    separator: ' then ',
  },
};

/** `joins: 'all'` — a separator between every pair of chips: `⌘ + ⇧ + K`. */
export const JoinAll: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'K' }],
    joins: 'all',
  },
};

/** `joins: 'key'` (the default) — a separator before each non-modifier: `⌘ ⇧ + K`. */
export const JoinKey: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'K' }],
    joins: 'key',
  },
};

/** `joins: 'none'` — no separator at all; chips abut. */
export const JoinNone: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'K' }],
    joins: 'none',
  },
};

/** The default variant takes `currentColor`. Useful next to badges /
 *  colored text in tables. */
export const InColoredText: Story = {
  args: {
    keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'P' }],
  },
  render: ({ platform = 'macos', legend = 'auto', keys, font, ...rest }) => (
    <span className={s.colored}>
      Quick action: <KeySequence {...rest} keys={relabelKeys(keys, platform, legend)} font={resolveFont(font)} />
    </span>
  ),
};

/** Side-by-side comparison: same shortcuts in inverse vs default (under a
 *  colored container). Honors `platform` + `legend`. */
export const Gallery: Story = {
  tags: ['gallery'],
  args: { platform: 'macos', legend: 'auto', font: 'system sans' },
  argTypes: {
    keys: { table: { disable: true } },
    separator: { table: { disable: true } },
    joins: { table: { disable: true } },
    variant: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'auto', font }) => (
    <KeySequenceGallery platform={platform} legend={legend} font={resolveFont(font)} />
  ),
};

function KeySequenceGallery({ platform, legend, font }: { platform: Platform; legend: LegendStyle; font?: string }): ReactElement {
  const cases: Array<{ label: string; keys: KeyLegend[] }> = [
    { label: 'Cmd+K', keys: [{ label: '⌘' }, { label: 'K' }] },
    { label: 'Cmd+Shift+P', keys: [{ label: '⌘' }, { label: '⇧' }, { label: 'P' }] },
    { label: 'Cmd+(opt)Shift+P', keys: [{ label: '⌘' }, { label: '⇧', optional: true }, { label: 'P' }] },
    { label: 'Cmd+Enter', keys: [{ label: '⌘' }, { label: '↵' }] },
    { label: 'Esc', keys: [{ label: '⎋' }] },
  ];
  return (
    <table className={s.gallery}>
      <thead>
        <tr>
          <th>case</th>
          <th>inverse</th>
          <th>default (in colored text)</th>
        </tr>
      </thead>
      <tbody>
        {cases.map((c) => {
          const keys = relabelKeys(c.keys, platform, legend);
          return (
            <tr key={c.label}>
              <td>{c.label}</td>
              <td><KeySequence keys={keys} variant="inverse" font={font} /></td>
              <td className={s.colored}><KeySequence keys={keys} font={font} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
