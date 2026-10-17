import type { Meta, StoryObj } from '@weasel-js/forge';
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { KeyBank } from './KeyBank';
import { KeyCap } from './Keycap';
import { FONT_OPTIONS, resolveFont } from './keycapStoryFonts';
import { keySpecFromKey, keySpecsFromMods, type LegendStyle, type Platform } from '@weasel-js/gestures';

const PLATFORMS: Platform[] = ['macos', 'windows', 'linux'];
const LEGENDS: LegendStyle[] = ['auto', 'symbol', 'text'];

interface StoryArgs {
  /** `auto` picks the per-entry, per-platform label; `symbol` and `text`
   *  force one form across the board. */
  legend?: LegendStyle;
  /** Font preset or font-family forwarded to every key. */
  font?: string;
  /** Forwarded to every bank: lets a key print a two-line spelling. */
  wrap?: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'ui/Foundations/Keycaps/Keyboard layouts',
  component: KeyBank,
  args: { legend: 'auto', font: 'oswald', wrap: true },
  argTypes: {
    legend: { control: 'inline-radio', options: LEGENDS },
    font: { control: 'select', options: FONT_OPTIONS },
    wrap: { control: 'boolean', description: 'Lets a key print a two-line spelling, as Pg / Up.' },
  },
};
export default meta;
type Story = StoryObj<StoryArgs>;

/** Side-by-side keyboard layouts for macOS / Windows / Linux, with keys
 *  grouped into banks the way a keyboard groups them: the function row, the
 *  main block, the navigation cluster with the PrtSc row, and the arrows.
 *  Every single-line legend in a bank prints at one size. */
export const KeyboardLayouts: Story = {
  render: ({ legend = 'auto', font, wrap = true }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {PLATFORMS.map((p) => (
        <KeyboardLayout key={p} platform={p} legend={legend} font={resolveFont(font)} wrap={wrap} />
      ))}
    </div>
  ),
};

// ANSI TKL layout. A n-unit key's width is `n * U + (n - 1) * GAP`, for
// keys and spacers alike, so rows of equal slot-count line up. Every
// main-block row sums to 15 slots and every right-cluster row to 3; on macOS a
// trailing spacer pads the short modifier row to 15.
const GAP = 3;
const LAYOUT_WEIGHT = 300;
const unit = (n: number) => `calc(${n} * var(--wzl-control-h-xs) + ${(n - 1) * GAP}px)`;

function KeyboardLayout({ platform, legend, font, wrap }: { platform: Platform; legend: LegendStyle; font?: string; wrap: boolean }): ReactElement {
  const mod = (name: 'shift' | 'ctrl' | 'alt' | 'meta') => keySpecsFromMods([{ name }], { platform, legend })[0].label;
  const named = (key: string) => keySpecFromKey(key, { platform, legend }).label;
  const [shift, ctrl, alt, meta] = [mod('shift'), mod('ctrl'), mod('alt'), mod('meta')];

  // Multi-character legends default to the `wide` kind; the explicit width
  // keeps them to the slot accounting.
  const cap = (label: string, n = 1, key = label) => (
    <KeyCap key={key} label={label} font={font} style={{ width: unit(n), minWidth: 0, padding: '0 2px', fontWeight: LAYOUT_WEIGHT }} />
  );
  const caps = (labels: readonly string[]) => labels.map((k) => cap(k));

  return (
    <section>
      <header style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.65, marginBottom: 6 }}>
        {platform}
      </header>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: unit(0.5) }}>
        <Column>
          <KeyBank wrap={wrap}>
            <Row fnRow>
              {cap(named('Escape'))}
              <Spacer width={unit(1)} />
              {caps(['F1', 'F2', 'F3', 'F4'])}
              <Spacer width={unit(0.5)} />
              {caps(['F5', 'F6', 'F7', 'F8'])}
              <Spacer width={unit(0.5)} />
              {caps(['F9', 'F10', 'F11', 'F12'])}
            </Row>
          </KeyBank>
          <KeyBank wrap={wrap}>
            <Row>
              {caps(['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='])}
              {cap(named('Backspace'), 2)}
            </Row>
            <Row>
              {cap(named('Tab'), 1.5)}
              {caps(['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'])}
              {cap('\\', 1.5)}
            </Row>
            <Row>
              {cap('Caps', 1.75)}
              {caps(['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"])}
              {cap(named('Enter'), 2.25)}
            </Row>
            <Row>
              {cap(shift, 2.25, 'shiftL')}
              {caps(['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'])}
              {cap(shift, 2.75, 'shiftR')}
            </Row>
            {platform === 'macos' ? (
              <Row>
                {cap('fn')}
                {cap(ctrl)}
                {cap(alt, 1, 'altL')}
                {cap(meta, 1.25, 'metaL')}
                {cap(named('Space'), 6.25)}
                {cap(meta, 1.25, 'metaR')}
                {cap(alt, 1, 'altR')}
                <Spacer width={unit(1)} />
              </Row>
            ) : (
              <Row>
                {cap(ctrl, 1.25, 'ctrlL')}
                {cap(meta, 1.25, 'metaL')}
                {cap(alt, 1.25, 'altL')}
                {cap(named('Space'), 6.25)}
                {cap(alt, 1.25, 'altR')}
                {cap(meta, 1.25, 'metaR')}
                {cap(named('ContextMenu'), 1.25)}
                {cap(ctrl, 1.25, 'ctrlR')}
              </Row>
            )}
          </KeyBank>
        </Column>
        <Column>
          <KeyBank wrap={wrap}>
            <Row fnRow>{caps([named('PrintScreen'), named('ScrollLock'), named('Pause')])}</Row>
            <Row>{caps([named('Insert'), named('Home'), named('PageUp')])}</Row>
            <Row>{caps([named('Delete'), named('End'), named('PageDown')])}</Row>
          </KeyBank>
          <Row><Spacer width={unit(3)} /></Row>
          <KeyBank wrap={wrap}>
            <Row><Spacer width={unit(1)} />{cap('↑')}<Spacer width={unit(1)} /></Row>
            <Row>{caps(['←', '↓', '→'])}</Row>
          </KeyBank>
        </Column>
      </div>
    </section>
  );
}

function Column({ children }: { children: ReactNode }): ReactElement {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>{children}</div>;
}

/** One row of keys, bottom-aligned so icon and letter legends share an edge.
 *  `fnRow` leaves the small gap a keyboard has below its function row. */
function Row({ children, fnRow }: { children: ReactNode; fnRow?: boolean }): ReactElement {
  const style: CSSProperties = { display: 'flex', gap: GAP, alignItems: 'flex-end', marginBottom: fnRow ? 6 : 0 };
  return <div style={style}>{children}</div>;
}

function Spacer({ width }: { width: string }): ReactElement {
  return <span aria-hidden style={{ display: 'inline-block', width, height: 'var(--wzl-control-h-xs)' }} />;
}
