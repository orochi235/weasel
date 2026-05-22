import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactElement } from 'react';
import { KeyCap, type KeyCapVariant, type KeyCapProps } from './Keycap';

const VARIANTS: KeyCapVariant[] = ['default', 'minimal'];

type Platform = 'macos' | 'windows' | 'linux';
const PLATFORMS: Platform[] = ['macos', 'windows', 'linux'];

type LegendStyle = 'symbol' | 'text';
const LEGEND_STYLES: LegendStyle[] = ['symbol', 'text'];

/** Per-platform × per-legend-style table for modifier labels. macOS keeps
 *  the Apple glyphs in symbol mode; Windows / Linux fall back to text since
 *  there's no widely-recognized symbol for Alt/Ctrl/Win. */
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

/** Non-modifier glyph → symbol/text alternates. Arrows have no text form. */
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

interface StoryArgs extends KeyCapProps {
  /** Storybook-only — substitutes the input modifier glyph for the
   *  platform-native form. The KeyCap component itself is platform-agnostic;
   *  this control lets stories preview each platform's conventions. */
  platform?: Platform;
  /** Storybook-only — symbol form (⌘ / ⌥ / ↵ / ⎋) vs text form
   *  (Cmd / Option / Enter / Esc). Modifier glyphs without a recognized
   *  platform symbol fall back to text in both modes. */
  legend?: LegendStyle;
}

const meta: Meta<StoryArgs> = {
  title: 'weasel-ui/Foundations/Keycaps/KeyCap',
  component: KeyCap,
  args: {
    label: 'K',
    inverted: false,
    variant: 'default',
    platform: 'macos',
    legend: 'symbol',
  },
  argTypes: {
    label: {
      control: 'text',
      description:
        'Glyph rendered in the chip. Feed it the macOS symbol form (⌘ ⌥ ⌃ ⇧ ↵ ⇥ ␣ ⎋ ⌫ ⌦); the platform + legend controls rewrite it.',
    },
    inverted: {
      control: 'boolean',
      description: 'Marks the chip as optional. Default variant flips face + dotted border; minimal uses a dotted border only.',
    },
    variant: {
      control: 'inline-radio',
      options: VARIANTS,
      description: '`default` = filled chip. `minimal` = currentColor border + legend, no fill.',
    },
    platform: {
      control: 'inline-radio',
      options: PLATFORMS,
      description: 'Rewrites modifier glyphs for the platform (e.g. ⌘ → Win on Windows).',
    },
    legend: {
      control: 'inline-radio',
      options: LEGEND_STYLES,
      description: '`symbol` keeps glyphs (⌘, ↵). `text` spells them out (Cmd, Enter).',
    },
    className: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'symbol', label, ...rest }) => (
    <KeyCap {...rest} label={relabel(label, platform, legend)} />
  ),
};
export default meta;
type Story = StoryObj<StoryArgs>;

/** Default chip — a single ordinary key. */
export const Default: Story = {};

/** Modifier glyphs (⌘ ⌥ ⌃ ⇧ ⇪) auto-get a wider chip. Try the platform +
 *  legend controls to see Cmd / Win / Super / Option / Alt substitutions. */
export const Modifier: Story = {
  args: { label: '⌘' },
};

/** Wide glyphs (⇥ ↵ ␣) and multi-character labels render extra-wide. */
export const Wide: Story = {
  args: { label: '↵' },
};

/** Inverted chip — under the default variant, face flips and the border
 *  becomes dotted in the legend color. */
export const Inverted: Story = {
  args: { label: '⌘', inverted: true },
};

/** Minimal variant — no fill; border + legend follow `currentColor`. Use
 *  inline in colored prose / next to colored badges where the chip should
 *  take the surrounding text color. */
export const Minimal: Story = {
  args: { label: 'K', variant: 'minimal' },
};

/** `minimal` inside a colored container — the chip picks up the parent's
 *  `color`. */
export const MinimalInColoredText: Story = {
  args: { label: '⌘', variant: 'minimal' },
  render: ({ platform = 'macos', legend = 'symbol', label, ...rest }) => (
    <span style={{ color: '#7fb069' }}>
      Press <KeyCap {...rest} label={relabel(label, platform, legend)} /> to confirm.
    </span>
  ),
};

/** Optional under `minimal` — the border goes dotted to read as
 *  "may be held but isn't required." */
export const MinimalOptional: Story = {
  args: { label: '⇧', variant: 'minimal', inverted: true },
};

/** Every `KeycapKind` (`square` / `modifier` / `wide`) and every variant
 *  combination side by side. The `platform` and `legend` controls affect
 *  the modifier and named-key rows. */
export const Gallery: Story = {
  args: { platform: 'macos', legend: 'symbol' },
  argTypes: {
    label: { table: { disable: true } },
    inverted: { table: { disable: true } },
    variant: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'symbol' }) => (
    <KeyCapGallery platform={platform} legend={legend} />
  ),
};

function KeyCapGallery({ platform, legend }: { platform: Platform; legend: LegendStyle }): ReactElement {
  const rows: Array<{ label: string; kind: 'square' | 'modifier' | 'wide' }> = [
    { label: 'A', kind: 'square' },
    { label: '⌘', kind: 'modifier' },
    { label: '⇧', kind: 'modifier' },
    { label: '⌥', kind: 'modifier' },
    { label: '⌃', kind: 'modifier' },
    { label: '↵', kind: 'wide' },
    { label: '⇥', kind: 'wide' },
    { label: '␣', kind: 'wide' },
    { label: '⎋', kind: 'wide' },
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
          <th style={cell}>input label</th>
          <th style={cell}>kind</th>
          <th style={cell}>default</th>
          <th style={cell}>inverted</th>
          <th style={cell}>minimal</th>
          <th style={cell}>minimal + optional</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const rendered = relabel(r.label, platform, legend);
          return (
            <tr key={r.label}>
              <td style={cell}><code>{r.label}</code></td>
              <td style={cell}>{r.kind}</td>
              <td style={cell}><KeyCap label={rendered} /></td>
              <td style={cell}><KeyCap label={rendered} inverted /></td>
              <td style={cell}><KeyCap label={rendered} variant="minimal" /></td>
              <td style={cell}><KeyCap label={rendered} variant="minimal" inverted /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
