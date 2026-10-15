import type { Meta, StoryObj } from '@weasel-js/forge';
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { KeyCap, type KeyCapVariant, type KeyCapProps } from './Keycap';
import {
  keySpecFromKey,
  keySpecsFromMods,
  type LegendStyle,
  type LogicalMod,
  type Platform,
} from './keySpecsFromMods';
import { KEYCAP_VARIANT_ICONS } from './variantIcons';

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

/** Side-by-side keyboard layouts for macOS / Windows / Linux. Renders an
 *  Esc + function-bar row, the symbol row, the alpha home row, and the
 *  control cluster — enough surface to show every OS-divergent label
 *  (Esc / Cmd / Win / Super / Option / Alt) at once. */
export const KeyboardLayouts: Story = {
  args: { legend: 'auto', font: 'oswald' },
  argTypes: {
    label: { table: { disable: true } },
    inverted: { table: { disable: true } },
    variant: { table: { disable: true } },
    platform: { table: { disable: true } },
  },
  render: ({ legend = 'auto', font }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {PLATFORMS.map((p) => (
        <KeyboardLayout key={p} platform={p} legend={legend} font={resolveFont(font)} />
      ))}
    </div>
  ),
};

function KeyboardLayout({ platform, legend, font }: { platform: Platform; legend: LegendStyle; font?: string }): ReactElement {
  // ANSI TKL layout. A n-unit key's width is `n * U + (n - 1) * GAP`, for
  // KeyCaps and Spacers alike, so rows of equal slot-count line up. Every
  // main-block row sums to 15 slots and every right-cluster row to 3; on
  // macOS a trailing spacer pads the short modifier row to 15.
  const GAP = 3;
  const unit = (n: number) => `calc(${n} * var(--wzl-control-h-xs) + ${(n - 1) * GAP}px)`;

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

  // Multi-char labels (F1, Esc, Caps, …) default to `wide` kind (min-width
  // 32px); without this override they'd break the slot accounting.
  const cap = (label: string, n = 1) => <FitCap label={label} width={unit(n)} font={font} />;
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
        <span key={k}>{cap(k)}</span>
      )),
      <span key="bs">{wide(backspace, 2)}</span>,
    ],
    // QWERTY row.
    [
      <span key="tab">{wide(tab, 1.5)}</span>,
      ...['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'].map((k) => (
        <span key={k}>{cap(k)}</span>
      )),
      <span key="bsl">{wide('\\', 1.5)}</span>,
    ],
    // Home row.
    [
      <span key="caps">{wide('Caps', 1.75)}</span>,
      ...['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"].map((k) => (
        <span key={k}>{cap(k)}</span>
      )),
      <span key="enter">{wide(enter, 2.25)}</span>,
    ],
    // Bottom (ZXCV) row.
    [
      <span key="shiftL">{wide(shift, 2.25)}</span>,
      ...['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'].map((k) => (
        <span key={k}>{cap(k)}</span>
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
    [<Spacer key="l" width={unit(1)} />, <span key="up">{cap('↑')}</span>, <Spacer key="r" width={unit(1)} />],
    // Modifier-row alignment — Left / Down / Right.
    [<span key="left">{cap('←')}</span>, <span key="down">{cap('↓')}</span>, <span key="right">{cap('→')}</span>],
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

/** Other spellings a legend may take when it overflows its key, in order of
 *  preference: shorter words, then the two-line forms real keycaps print. */
const OTHER_FORMS: Record<string, readonly string[]> = {
  Control: ['Ctrl'], Option: ['Opt'], Delete: ['Del'], Backspace: ['Bksp', 'Back\nspace'], Return: ['Ret'],
  Super: ['Sup'], PrtSc: ['Prt\nSc'], ScrLk: ['Scr\nLk'], PgUp: ['Pg\nUp'], PgDn: ['Pg\nDn'],
};
/** How far a legend's type may shrink before it is left to overflow. */
const MIN_SCALE = 0.6;
const LAYOUT_WEIGHT = 300;
/** Line height of a two-line legend, tight so both lines fit a short key. */
const BROKEN_LINE_HEIGHT = 0.85;

let measureCtx: CanvasRenderingContext2D | null = null;

/** A layout key whose legend is the first of its spellings that fits at full
 *  size, else a two-line one, else the one that fits at the largest type,
 *  shrunk no further than {@link MIN_SCALE}. */
function FitCap({ label, width, font }: { label: string; width: string; font?: string }): ReactElement {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState({ label, scale: 1 });
  const scaleRef = useRef(1);
  scaleRef.current = fit.scale;

  useLayoutEffect(() => {
    const kbd = ref.current?.querySelector('kbd');
    if (!kbd) return;
    let live = true;
    const measure = () => {
      measureCtx ??= document.createElement('canvas').getContext('2d');
      if (!live || !measureCtx) return;
      const ctx = measureCtx;
      const cs = getComputedStyle(kbd);
      const px = (v: string) => parseFloat(v) || 0;
      const size = px(cs.fontSize) / scaleRef.current;
      ctx.font = `${LAYOUT_WEIGHT} ${size}px ${cs.fontFamily}`;
      const roomW = kbd.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
      const roomH = kbd.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - 4;
      const fits = [label, ...(OTHER_FORMS[label] ?? [])].map((form) => {
        const lines = form.split('\n');
        const wide = Math.max(...lines.map((l) => ctx.measureText(l).width));
        return { label: form, broken: lines.length > 1, scale: Math.min(1, roomW / wide, roomH / (lines.length * size * (lines.length > 1 ? BROKEN_LINE_HEIGHT : 1))) };
      });
      const largest = (list: typeof fits) => list.reduce((a, b) => (b.scale > a.scale + 0.01 ? b : a));
      // Nothing fits at full size: a key's printed line break reads better than smaller type.
      const broken = fits.filter((f) => f.broken && f.scale >= MIN_SCALE);
      const best = fits.find((f) => f.scale >= 1) ?? (broken.length ? largest(broken) : largest(fits));
      setFit({ label: best.label, scale: Math.max(MIN_SCALE, best.scale) });
    };
    measure();
    void document.fonts?.ready.then(measure);
    return () => { live = false; };
  }, [label, width, font]);

  return (
    <span ref={ref}>
      <KeyCap
        label={fit.label}
        style={{
          width, minWidth: 0, padding: '0 2px', fontWeight: LAYOUT_WEIGHT,
          fontSize: `calc(var(--key-font-size) * ${fit.scale.toFixed(3)})`,
          whiteSpace: 'pre-line', textAlign: 'center',
          lineHeight: fit.label.includes('\n') ? BROKEN_LINE_HEIGHT : undefined,
        }}
        font={font}
      />
    </span>
  );
}

function Spacer({ width, height }: { width: number | string; height?: number | string }): ReactElement {
  return <span aria-hidden style={{ display: 'inline-block', width, height: height ?? 'var(--wzl-control-h-xs)' }} />;
}
