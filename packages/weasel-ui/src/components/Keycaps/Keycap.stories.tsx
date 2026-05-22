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
  // ANSI TKL layout.
  //
  // Geometry: 1u = 18px (matches `.key[data-kind='square']` width); the
  // flex row carries `gap: 3px` between siblings. A n-unit key's width
  // is `n * U + (n - 1) * GAP` — that's the formula `unit(n)`. Using
  // it for both KeyCaps AND Spacers makes every element occupy exactly
  // n slots of horizontal space, so rows of equal slot-count line up
  // perfectly regardless of which specific keys they contain.
  //
  // Slot accounting per row (all should sum to 15 slots for the main
  // block, 3 slots for the right cluster):
  //   fn row:   1 + 1.0 + 4×1 + 0.5 + 4×1 + 0.5 + 4×1 = 15  ✓
  //   numbers:  13×1 + 2 = 15                              ✓
  //   qwerty:   1.5 + 12×1 + 1.5 = 15                      ✓
  //   home:     1.75 + 11×1 + 2.25 = 15                    ✓
  //   bottom:   2.25 + 10×1 + 2.75 = 15                    ✓
  //   modifier: 7×1.25 + 6.25 = 15 (ANSI Win/Linux)        ✓
  //             — macOS: trailing spacer pads the short row to 15
  const U = 18;
  const GAP = 3;
  const unit = (n: number) => n * U + (n - 1) * GAP;

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

  // Force a chip to a precise slot-width regardless of how `inferKeycapKind`
  // would have classified its label. Multi-char labels (F1, Esc, Caps, …)
  // default to `wide` kind (min-width 32px); without this override they'd
  // break the slot accounting. Padding tightens so longer labels still fit
  // their unit-cell.
  const cap = (label: string, n = 1) => (
    <KeyCap
      label={label}
      style={{ width: unit(n), minWidth: 0, padding: '0 2px' }}
    />
  );
  const wide = cap;

  // ── Main block: 15-slot rows ──────────────────────────────────────
  const mainRows: ReactElement[][] = [
    // Function row.
    [
      <span key="esc">{cap(esc)}</span>,
      <Spacer key="g1" width={unit(1)} />,
      ...['F1', 'F2', 'F3', 'F4'].map((k) => <span key={k}>{cap(k)}</span>),
      <Spacer key="g2" width={unit(0.5)} />,
      ...['F5', 'F6', 'F7', 'F8'].map((k) => <span key={k}>{cap(k)}</span>),
      <Spacer key="g3" width={unit(0.5)} />,
      ...['F9', 'F10', 'F11', 'F12'].map((k) => <span key={k}>{cap(k)}</span>),
    ],
    // Number row.
    [
      ...['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='].map((k) => (
        <KeyCap key={k} label={k} />
      )),
      <span key="bs">{wide(backspace, 2)}</span>,
    ],
    // QWERTY row.
    [
      <span key="tab">{wide(tab, 1.5)}</span>,
      ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'].map((k) => (
        <KeyCap key={k} label={k} />
      )),
      <span key="bsl">{wide('\\', 1.5)}</span>,
    ],
    // Home row.
    [
      <span key="caps">{wide('Caps', 1.75)}</span>,
      ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"].map((k) => (
        <KeyCap key={k} label={k} />
      )),
      <span key="enter">{wide(enter, 2.25)}</span>,
    ],
    // Bottom (ZXCV) row.
    [
      <span key="shiftL">{wide(shift, 2.25)}</span>,
      ...['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'].map((k) => (
        <KeyCap key={k} label={k} />
      )),
      <span key="shiftR">{wide(shift, 2.75)}</span>,
    ],
    // Modifier row — platform-specific.
    platform === 'macos'
      ? [
          <span key="fn">{cap('fn')}</span>,
          <span key="ctrl">{cap(ctrl)}</span>,
          <span key="alt">{cap(alt)}</span>,
          <span key="meta1">{wide(meta, 1.25)}</span>,
          <span key="space">{wide(space, 6.25)}</span>,
          <span key="meta2">{wide(meta, 1.25)}</span>,
          <span key="alt2">{cap(alt)}</span>,
          <Spacer key="pad" width={unit(1)} />,
        ]
      : [
          <span key="ctrl1">{wide(ctrl, 1.25)}</span>,
          <span key="meta1">{wide(meta, 1.25)}</span>,
          <span key="alt1">{wide(alt, 1.25)}</span>,
          <span key="space">{wide(space, 6.25)}</span>,
          <span key="alt2">{wide(alt, 1.25)}</span>,
          <span key="meta2">{wide(meta, 1.25)}</span>,
          <span key="menu">{wide(keySpecFromKey('ContextMenu', { platform, legend }).label, 1.25)}</span>,
          <span key="ctrl2">{wide(ctrl, 1.25)}</span>,
        ],
  ];

  // ── Right cluster: 3-slot rows ────────────────────────────────────
  // Each cluster row aligns vertically with the corresponding main row.
  // Empty slots use Spacers of the same slot-width so alignment is
  // pixel-perfect.
  const clusterRows: ReactElement[][] = [
    // Function row alignment: PrtSc / ScrLk / Pause.
    [<span key="prtsc">{cap('PrtSc')}</span>, <span key="scrlk">{cap('ScrLk')}</span>, <span key="pause">{cap('Pause')}</span>],
    // Number row alignment.
    [<span key="ins">{cap('Ins')}</span>, <span key="home">{cap('Home')}</span>, <span key="pgup">{cap('PgUp')}</span>],
    // QWERTY row alignment.
    [<span key="del">{cap(del)}</span>, <span key="end">{cap('End')}</span>, <span key="pgdn">{cap('PgDn')}</span>],
    // Home row alignment — empty.
    [<Spacer key="e1" width={unit(3)} />],
    // Bottom-row alignment — Up alone in the middle slot.
    [<Spacer key="l" width={unit(1)} />, <KeyCap key="up" label="↑" />, <Spacer key="r" width={unit(1)} />],
    // Modifier-row alignment — Left / Down / Right.
    [<KeyCap key="left" label="←" />, <KeyCap key="down" label="↓" />, <KeyCap key="right" label="→" />],
  ];

  return (
    <section>
      <header style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.65, marginBottom: 6 }}>
        {platform}
      </header>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: unit(1) + GAP }}>
        <KeyboardBlock rows={mainRows} gap={GAP} fnRowSpacing />
        <KeyboardBlock rows={clusterRows} gap={GAP} fnRowSpacing />
      </div>
    </section>
  );
}

/** Stack of rows. `fnRowSpacing` inserts a small vertical gap between
 *  the first row (function row) and the rest, matching real keyboards. */
function KeyboardBlock({
  rows,
  gap,
  fnRowSpacing,
}: {
  rows: readonly ReactElement[][];
  gap: number;
  fnRowSpacing?: boolean;
}): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap,
            // Bottom-align so glyphs sitting on different baselines (icon
            // arrows vs typeset letters vs ⌘) line up along the bottom
            // edge of the chips rather than drifting on the baseline.
            alignItems: 'flex-end',
            marginTop: i === 1 && fnRowSpacing ? 6 : 0,
          }}
        >
          {row}
        </div>
      ))}
    </div>
  );
}

function Spacer({ width, height }: { width: number; height?: number }): ReactElement {
  return <span aria-hidden style={{ display: 'inline-block', width, height: height ?? 18 }} />;
}
