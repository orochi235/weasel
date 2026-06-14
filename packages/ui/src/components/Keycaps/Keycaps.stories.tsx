import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactElement } from 'react';
import { KeySequence, type KeySpec, type KeySequenceProps } from './Keycaps';
import {
  keySpecFromKey,
  keySpecsFromMods,
  type KeyCapVariant,
  type LegendStyle,
  type LogicalMod,
  type Platform,
} from './index';

const VARIANTS: KeyCapVariant[] = ['default', 'minimal'];
const PLATFORMS: Platform[] = ['macos', 'windows', 'linux'];
const LEGEND_STYLES: LegendStyle[] = ['auto', 'symbol', 'text'];

const MOD_BY_GLYPH: Record<string, LogicalMod | undefined> = {
  '⌘': 'mod', '⇧': 'shift', '⌥': 'alt', '⌃': 'ctrl', '⇪': 'meta',
};
const NAMED_BY_GLYPH: Record<string, string | undefined> = {
  '⎋': 'Escape', '↵': 'Enter', '⇥': 'Tab', '␣': 'Space', '⌫': 'Backspace', '⌦': 'Delete',
};

function relabel(label: string, platform: Platform, legend: LegendStyle): string {
  const mod = MOD_BY_GLYPH[label];
  if (mod) return keySpecsFromMods([{ name: mod }], { platform, legend })[0].label;
  const named = NAMED_BY_GLYPH[label];
  if (named) return keySpecFromKey(named, { platform, legend }).label;
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

const FONT_PRESETS: Record<string, string> = {
  'system sans': 'ui-sans-serif, system-ui, sans-serif',
  'system mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'serif':       'ui-serif, Georgia, serif',
  'inter':       'Inter, system-ui, sans-serif',
  'oswald':      "'Oswald', sans-serif",
};
const FONT_OPTIONS = Object.keys(FONT_PRESETS);
function resolveFont(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return FONT_PRESETS[value] ?? value;
}

const meta: Meta<StoryArgs> = {
  title: 'weasel-ui/Foundations/Keycaps/KeySequence',
  component: KeySequence,
  args: {
    keys: [{ label: '⌘' }, { label: 'K' }],
    separator: '+',
    variant: 'default',
    platform: 'macos',
    legend: 'auto',
    font: 'system sans',
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
  render: ({ platform = 'macos', legend = 'auto', keys, font, ...rest }) => (
    <span style={{ color: '#d4a574', fontSize: 14 }}>
      Quick action: <KeySequence {...rest} keys={relabelKeys(keys, platform, legend)} font={resolveFont(font)} />
    </span>
  ),
};

/** Side-by-side comparison: same shortcuts in default vs minimal (under a
 *  colored container). Honors `platform` + `legend`. */
export const Gallery: Story = {
  args: { platform: 'macos', legend: 'auto', font: 'system sans' },
  argTypes: {
    keys: { table: { disable: true } },
    separator: { table: { disable: true } },
    variant: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'auto', font }) => (
    <KeySequenceGallery platform={platform} legend={legend} font={resolveFont(font)} />
  ),
};

function KeySequenceGallery({ platform, legend, font }: { platform: Platform; legend: LegendStyle; font?: string }): ReactElement {
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
    <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
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
              <td style={cell}><KeySequence keys={keys} font={font} /></td>
              <td style={{ ...cell, color: '#7fb069' }}><KeySequence keys={keys} variant="minimal" font={font} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
