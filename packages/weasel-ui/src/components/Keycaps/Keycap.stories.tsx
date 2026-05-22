import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CSSProperties, ReactElement } from 'react';
import { KeyCap, type KeyCapVariant, type KeyCapProps } from './Keycap';
import {
  keySpecFromKey,
  keySpecsFromMods,
  type LegendStyle,
  type LogicalMod,
  type Platform,
} from './keySpecsFromMods';

const VARIANTS: KeyCapVariant[] = ['default', 'minimal'];
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
  /** Storybook-only — substitutes the input modifier or named-key glyph
   *  for the platform-native form via `keySpecsFromMods` / `keySpecFromKey`. */
  platform?: Platform;
  /** Storybook-only — `auto` (default) picks symbol on macOS, text
   *  elsewhere. `symbol` and `text` force a specific form. */
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
    legend: 'auto',
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
      description: 'Rewrites modifier and named-key glyphs for the platform.',
    },
    legend: {
      control: 'inline-radio',
      options: LEGENDS,
      description: '`auto` (default): symbol on macOS, text elsewhere. `symbol` / `text` force a specific form.',
    },
    className: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'auto', label, ...rest }) => (
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

/** Named keys (Esc, Enter, Tab, Space, Backspace, Delete) get a platform-
 *  appropriate label — `⎋` on macOS, `Esc` on Windows / Linux. */
export const NamedKey: Story = {
  args: { label: '⎋' },
};

/** Wide glyphs and multi-character labels render extra-wide. */
export const Wide: Story = {
  args: { label: '↵' },
};

/** Inverted chip — under the default variant, face flips, the border
 *  becomes dotted in the legend color, and the legend drops to 60%
 *  opacity. */
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
  render: ({ platform = 'macos', legend = 'auto', label, ...rest }) => (
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
  args: { platform: 'macos', legend: 'auto' },
  argTypes: {
    label: { table: { disable: true } },
    inverted: { table: { disable: true } },
    variant: { table: { disable: true } },
  },
  render: ({ platform = 'macos', legend = 'auto' }) => (
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
    <table style={{ borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr>
          <th style={cell}>input label</th>
          <th style={cell}>kind</th>
          <th style={cell}>default</th>
          <th style={cell}>optional</th>
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

/** Side-by-side keyboard layouts for macOS / Windows / Linux. Renders an
 *  Esc + function-bar row, the symbol row, the alpha home row, and the
 *  control cluster — enough surface to show every OS-divergent label
 *  (Esc / Cmd / Win / Super / Option / Alt) at once. */
export const KeyboardLayouts: Story = {
  args: { legend: 'auto' },
  argTypes: {
    label: { table: { disable: true } },
    inverted: { table: { disable: true } },
    variant: { table: { disable: true } },
    platform: { table: { disable: true } },
  },
  render: ({ legend = 'auto' }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {PLATFORMS.map((p) => (
        <KeyboardLayout key={p} platform={p} legend={legend} />
      ))}
    </div>
  ),
};

function KeyboardLayout({ platform, legend }: { platform: Platform; legend: LegendStyle }): ReactElement {
  // ANSI TKL layout. Standard key = 18px (`.key[data-kind='square']`),
  // gap = 3px. Multi-unit keys override width inline.
  const U = 18;
  const GAP = 3;
  // n-unit width including the gaps the chip displaces.
  const unit = (n: number) => n * U + (n - 1) * GAP;
  // Space between the main block and the nav/arrow cluster.
  const CLUSTER_GAP = unit(0.5) + GAP;

  const shift = keySpecsFromMods([{ name: 'shift' }], { platform, legend })[0].label;
  const ctrl = keySpecsFromMods([{ name: 'ctrl' }], { platform, legend })[0].label;
  const alt = keySpecsFromMods([{ name: 'alt' }], { platform, legend })[0].label;
  const meta = keySpecsFromMods([{ name: 'meta' }], { platform, legend })[0].label;
  const space = keySpecFromKey('Space', { platform, legend }).label;
  const tab = keySpecFromKey('Tab', { platform, legend }).label;
  const enter = keySpecFromKey('Enter', { platform, legend }).label;
  const backspace = keySpecFromKey('Backspace', { platform, legend }).label;
  const esc = keySpecFromKey('Escape', { platform, legend }).label;
  const del = keySpecFromKey('Delete', { platform, legend }).label;

  // Function row — Esc + F1..F12 grouped, plus PrtSc/ScrLk/Pause cluster.
  const fnRow: ReactElement[] = [
    <KeyCap key="esc" label={esc} />,
    <Spacer key="g1" width={unit(0.6)} />,
    ...['F1', 'F2', 'F3', 'F4'].map((k) => <KeyCap key={k} label={k} />),
    <Spacer key="g2" width={unit(0.4)} />,
    ...['F5', 'F6', 'F7', 'F8'].map((k) => <KeyCap key={k} label={k} />),
    <Spacer key="g3" width={unit(0.4)} />,
    ...['F9', 'F10', 'F11', 'F12'].map((k) => <KeyCap key={k} label={k} />),
    <Spacer key="cluster" width={CLUSTER_GAP} />,
    <KeyCap key="prtsc" label="PrtSc" />,
    <KeyCap key="scrlk" label="ScrLk" />,
    <KeyCap key="pause" label="Pause" />,
  ];

  // Number row — backtick + 1-0 - = + Backspace (1.7u). Trailing Ins/Home/PgUp cluster.
  const numRow: ReactElement[] = [
    ...['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='].map((k) => (
      <KeyCap key={k} label={k} />
    )),
    <KeyCap key="bs" label={backspace} style={{ width: unit(1.7) }} />,
    <Spacer key="cluster" width={CLUSTER_GAP} />,
    <KeyCap key="ins" label="Ins" />,
    <KeyCap key="home" label="Home" />,
    <KeyCap key="pgup" label="PgUp" />,
  ];

  // QWERTY row — Tab (1.7u) + 12 keys + \. Trailing Del/End/PgDn cluster.
  const qwertyRow: ReactElement[] = [
    <KeyCap key="tab" label={tab} style={{ width: unit(1.7) }} />,
    ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'].map((k) => (
      <KeyCap key={k} label={k} />
    )),
    <KeyCap key="bsl" label="\\" />,
    <Spacer key="cluster" width={CLUSTER_GAP} />,
    <KeyCap key="del" label={del} />,
    <KeyCap key="end" label="End" />,
    <KeyCap key="pgdn" label="PgDn" />,
  ];

  // Home row — Caps (1.95u) + 11 keys + Enter (2.45u). No right cluster.
  const homeRow: ReactElement[] = [
    <KeyCap key="caps" label="Caps" style={{ width: unit(1.95) }} />,
    ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"].map((k) => (
      <KeyCap key={k} label={k} />
    )),
    <KeyCap key="enter" label={enter} style={{ width: unit(2.45) }} />,
  ];

  // Bottom (ZXCV) row — Shift (2.45u) + 10 keys + Shift (2.95u) + ↑ arrow.
  const bottomRow: ReactElement[] = [
    <KeyCap key="shiftL" label={shift} style={{ width: unit(2.45) }} />,
    ...['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'].map((k) => (
      <KeyCap key={k} label={k} />
    )),
    <KeyCap key="shiftR" label={shift} style={{ width: unit(2.95) }} />,
    <Spacer key="cluster" width={CLUSTER_GAP + unit(1) + GAP} />,
    <KeyCap key="up" label="↑" />,
  ];

  // Modifier row — platform-specific. Space bar is the dominant wide key.
  // Trailing arrow cluster: ← ↓ →.
  let modifierRow: ReactElement[];
  if (platform === 'macos') {
    modifierRow = [
      <KeyCap key="fn"     label="fn" />,
      <KeyCap key="ctrl"   label={ctrl} />,
      <KeyCap key="alt"    label={alt} />,
      <KeyCap key="meta"   label={meta} style={{ width: unit(1.25) }} />,
      <KeyCap key="space"  label={space} style={{ width: unit(5.5) }} />,
      <KeyCap key="meta2"  label={meta} style={{ width: unit(1.25) }} />,
      <KeyCap key="alt2"   label={alt} />,
    ];
  } else {
    modifierRow = [
      <KeyCap key="ctrl"  label={ctrl} style={{ width: unit(1.25) }} />,
      <KeyCap key="meta"  label={meta} style={{ width: unit(1.25) }} />,
      <KeyCap key="alt"   label={alt} style={{ width: unit(1.25) }} />,
      <KeyCap key="space" label={space} style={{ width: unit(6.25) }} />,
      <KeyCap key="alt2"  label={alt} style={{ width: unit(1.25) }} />,
      <KeyCap key="meta2" label={meta} style={{ width: unit(1.25) }} />,
      <KeyCap key="menu"  label="Menu" style={{ width: unit(1.25) }} />,
      <KeyCap key="ctrl2" label={ctrl} style={{ width: unit(1.25) }} />,
    ];
  }
  modifierRow.push(
    <Spacer key="cluster" width={CLUSTER_GAP} />,
    <KeyCap key="left" label="←" />,
    <KeyCap key="down" label="↓" />,
    <KeyCap key="right" label="→" />,
  );

  return (
    <section>
      <header style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.65, marginBottom: 6 }}>
        {platform}
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
        <Row gap={GAP}>{fnRow}</Row>
        <Spacer width={1} height={6} />
        <Row gap={GAP}>{numRow}</Row>
        <Row gap={GAP}>{qwertyRow}</Row>
        <Row gap={GAP}>{homeRow}</Row>
        <Row gap={GAP}>{bottomRow}</Row>
        <Row gap={GAP}>{modifierRow}</Row>
      </div>
    </section>
  );
}

function Row({ children, gap }: { children: ReactElement[]; gap: number }): ReactElement {
  return <div style={{ display: 'flex', gap, alignItems: 'center' }}>{children}</div>;
}

function Spacer({ width, height }: { width: number; height?: number }): ReactElement {
  return <span aria-hidden style={{ display: 'inline-block', width, height: height ?? 1 }} />;
}
