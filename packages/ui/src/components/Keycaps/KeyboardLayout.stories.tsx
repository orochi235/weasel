import type { Meta, StoryObj } from '@weasel-js/forge';
import type { LegendStyle, Platform } from '@weasel-js/gestures';
import { KeyDiagram, KEYBOARD_LAYOUTS } from '@weasel-js/ui/components/Keycaps';
import { FONT_OPTIONS, resolveFont } from './keycapStoryFonts';

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
  component: KeyDiagram,
  args: { legend: 'auto', font: 'oswald', wrap: true },
  argTypes: {
    legend: { control: 'inline-radio', options: LEGENDS },
    font: { control: 'select', options: FONT_OPTIONS },
    wrap: { control: 'boolean', description: 'Lets a key print a two-line spelling, as Pg / Up.' },
  },
};
export default meta;
type Story = StoryObj<StoryArgs>;

/** Each platform's ANSI tenkeyless layout, with keys grouped into banks the
 *  way a keyboard groups them: the function row, the main block, the
 *  navigation cluster with the PrtSc row, and the arrows. Every single-line
 *  legend in a bank prints at one size. */
export const KeyboardLayouts: Story = {
  render: ({ legend = 'auto', font, wrap = true }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {PLATFORMS.map((p) => (
        <section key={p}>
          <header style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.65, marginBottom: 6 }}>
            {p}
          </header>
          <KeyDiagram layout={KEYBOARD_LAYOUTS[p]} legend={legend} font={resolveFont(font)} wrap={wrap} />
        </section>
      ))}
    </div>
  ),
};
