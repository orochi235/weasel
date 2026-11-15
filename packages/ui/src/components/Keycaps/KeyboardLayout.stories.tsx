import type { Meta, StoryObj } from '@weasel-js/forge';
import type { LegendStyle, Platform } from '@weasel-js/gestures';
import { KeyDiagram, KEYBOARD_LAYOUTS } from '@weasel-js/ui/components/Keycaps';
import { FONT_OPTIONS, resolveFont } from './keycapFonts.story';
import s from './Keycaps.stories.module.css';

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
  title: 'ui/Keycaps/KeyboardLayout',
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
    <div className={s.column}>
      {PLATFORMS.map((p) => (
        <section key={p}>
          <header className={s.platform}>
            {p}
          </header>
          <KeyDiagram layout={KEYBOARD_LAYOUTS[p]} legend={legend} font={resolveFont(font)} wrap={wrap} />
        </section>
      ))}
    </div>
  ),
};
