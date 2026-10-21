import type { Meta, StoryObj } from '@weasel-js/forge';
import type { CSSProperties, ReactElement } from 'react';
import { KeyCap, type KeyCapVariant, type KeyCapProps, KEYCAP_VARIANT_ICONS } from '@weasel-js/ui/components/Keycaps';
import { FONT_OPTIONS, resolveFont } from './keycapStoryFonts';
import {
  keySpecFromKey,
  keySpecsFromMods,
  type LegendStyle,
  type LogicalMod,
  type Platform,
} from '@weasel-js/gestures';

const VARIANTS: KeyCapVariant[] = ['default', 'inverse'];
const PLATFORMS: Platform[] = ['macos', 'windows', 'linux'];
const LEGENDS: LegendStyle[] = ['auto', 'symbol', 'text'];

/** A story-only translator that picks the right label for the input glyph
 *  given the platform + legend pair. Delegates to the production helpers
 *  for everything they cover; passes other glyphs through unchanged. */
function relabel(label: string, platform: Platform, legend: LegendStyle): string {
  const modByGlyph: Record<string, LogicalMod | undefined> = {
    '⌘': 'mod', '⇧': 'shift', '⌥': 'alt', '⌃': 'ctrl', '⇪': 'meta',
  };
  const mod = modByGlyph[label];
  if (mod) {
    const [spec] = keySpecsFromMods([{ name: mod }], { platform, legend });
    return spec.label;
  }
  const namedByGlyph: Record<string, string | undefined> = {
    '⎋': 'Escape', '↵': 'Enter', '⇥': 'Tab', '␣': 'Space', '⌫': 'Backspace', '⌦': 'Delete',
  };
  const named = namedByGlyph[label];
  if (named) return keySpecFromKey(named, { platform, legend }).label;
  return label;
}

interface StoryArgs extends KeyCapProps {
  /** Story-only — substitutes the input modifier or named-key glyph
   *  for the platform-native form via `keySpecsFromMods` / `keySpecFromKey`. */
  platform?: Platform;
  /** Story-only — `auto` (default) picks the per-entry, per-platform
   *  label; `symbol` and `text` force one form across the board. */
  legend?: LegendStyle;
}

const meta: Meta<StoryArgs> = {
  title: 'ui/Foundations/Keycaps/KeyCap',
  component: KeyCap,
  args: {
    label: 'K',
    inverted: false,
    variant: 'default',
    platform: 'macos',
    legend: 'auto',
    font: 'system sans',
  },
  argTypes: {
    label: {
      control: 'text',
      description:
        'Glyph rendered in the chip. Feed it the macOS symbol form (⌘ ⌥ ⌃ ⇧ ↵ ⇥ ␣ ⎋ ⌫ ⌦); the platform + legend controls rewrite it.',
    },
    inverted: {
      control: 'boolean',
      description: 'Marks the chip as optional. The default variant goes to a dotted border; inverse also flips its face and dims its legend.',
    },
    variant: {
      control: { type: 'inline-radio', icons: KEYCAP_VARIANT_ICONS },
      options: VARIANTS,
      description: '`default` = currentColor border + legend, no fill. `inverse` = filled chip.',
    },
    platform: {
      control: 'inline-radio',
      options: PLATFORMS,
      description: 'Rewrites modifier and named-key glyphs for the platform.',
    },
    legend: {
      control: 'inline-radio',
      options: LEGENDS,
      description: '`auto` (default): per-entry per-platform default. `symbol` / `text` force a specific form.',
    },
    font: {
      control: 'select',
      options: FONT_OPTIONS,
      description: 'Forwarded to KeyCap as inline font-family. Defaults to system sans (the chip\'s native stack).',
    },
    className: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'auto', label, font, ...rest }) => (
    <KeyCap {...rest} label={relabel(label, platform, legend)} font={resolveFont(font)} />
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

/** Named keys (Esc, Enter, Tab, Space, Backspace, Delete) get a platform-
 *  appropriate label — `⎋` on macOS, `Esc` on Windows / Linux. */
export const NamedKey: Story = {
  args: { label: '⎋' },
};

/** Wide glyphs and multi-character labels render extra-wide. */
export const Wide: Story = {
  args: { label: '↵' },
};

/** Inverse variant — a filled chip. */
export const Inverse: Story = {
  args: { label: 'K', variant: 'inverse' },
};

/** Optional under `inverse` — the face flips, the border becomes dotted in
 *  the legend color, and the legend drops to 60% opacity. */
export const InverseOptional: Story = {
  args: { label: '⌘', variant: 'inverse', inverted: true },
};

/** The default variant inside a colored container — the chip picks up the
 *  parent's `color`. */
export const InColoredText: Story = {
  args: { label: '⌘' },
  render: ({ platform = 'macos', legend = 'auto', label, font, ...rest }) => (
    <span style={{ color: '#7fb069' }}>
      Press <KeyCap {...rest} label={relabel(label, platform, legend)} font={resolveFont(font)} /> to confirm.
    </span>
  ),
};

/** Optional — the border goes dotted to read as "may be held but isn't
 *  required." */
export const Optional: Story = {
  args: { label: '⇧', inverted: true },
};

/** Every `KeycapKind` (`square` / `modifier` / `wide`) and every variant
 *  combination side by side. The `platform` and `legend` controls affect
 *  the modifier and named-key rows. */
export const Gallery: Story = {
  tags: ['gallery'],
  args: { platform: 'macos', legend: 'auto', font: 'system sans' },
  argTypes: {
    label: { table: { disable: true } },
    inverted: { table: { disable: true } },
    variant: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'auto', font }) => (
    <KeyCapGallery platform={platform} legend={legend} font={resolveFont(font)} />
  ),
};

function KeyCapGallery({ platform, legend, font }: { platform: Platform; legend: LegendStyle; font?: string }): ReactElement {
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
    <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          <th style={cell}>input label</th>
          <th style={cell}>kind</th>
          <th style={cell}>default</th>
          <th style={cell}>optional</th>
          <th style={cell}>inverse</th>
          <th style={cell}>inverse + optional</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const rendered = relabel(r.label, platform, legend);
          return (
            <tr key={r.label}>
              <td style={cell}><code>{r.label}</code></td>
              <td style={cell}>{r.kind}</td>
              <td style={cell}><KeyCap label={rendered} font={font} /></td>
              <td style={cell}><KeyCap label={rendered} inverted font={font} /></td>
              <td style={cell}><KeyCap label={rendered} variant="inverse" font={font} /></td>
              <td style={cell}><KeyCap label={rendered} variant="inverse" inverted font={font} /></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
