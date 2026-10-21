import type { Meta, StoryObj } from '@weasel-js/forge';
import type { LegendStyle, Platform } from '@weasel-js/gestures';
import { KeyDiagram, type KeyMark, KEYBOARD_LAYOUTS, useHeldKeys } from '@weasel-js/ui/components/Keycaps';

interface StoryArgs {
  platform?: Platform;
  legend?: LegendStyle;
  /** Seconds the diagram stays up after the last key; 0 keeps it up. */
  linger?: number;
}

const meta: Meta<StoryArgs> = {
  title: 'ui/Foundations/Keycaps/KeyDiagram',
  component: KeyDiagram,
  args: { platform: 'macos', legend: 'auto', linger: 0 },
  argTypes: {
    platform: { control: 'inline-radio', options: ['macos', 'windows', 'linux'] },
    legend: { control: 'inline-radio', options: ['auto', 'symbol', 'text'] },
    linger: { control: { type: 'range', min: 0, max: 5, step: 0.5 } },
  },
};
export default meta;
type Story = StoryObj<StoryArgs>;

/** The whole keyboard, lighting each key while it is held. Click the page
 *  first so it has the keyboard. */
export const Live: Story = {
  render: function Live({ platform = 'macos', legend, linger }) {
    const held = useHeldKeys();
    return <KeyDiagram layout={KEYBOARD_LAYOUTS[platform]} legend={legend} held={held} linger={linger || undefined} />;
  },
};

const TURN = 'var(--wzl-swatch-violet)';
const MOVE = 'var(--wzl-swatch-sky)';
const ZOOM = 'var(--wzl-swatch-amber)';
const LIFT = 'var(--wzl-swatch-teal)';
const PITCH = 'var(--wzl-swatch-fuchsia)';

const CAMERA: Readonly<Record<string, KeyMark>> = {
  KeyQ: { caption: 'turn', tone: TURN },
  KeyW: { caption: 'fwd', tone: MOVE },
  KeyE: { caption: 'turn', tone: TURN },
  KeyR: { caption: 'climb', tone: LIFT },
  KeyA: { caption: 'left', tone: MOVE },
  KeyS: { caption: 'back', tone: MOVE },
  KeyD: { caption: 'right', tone: MOVE },
  KeyF: { caption: 'sink', tone: LIFT },
  KeyG: { caption: 'go to' },
  KeyZ: { caption: 'loupe' },
  KeyX: { caption: 'wide', tone: ZOOM },
  KeyC: { caption: 'close', tone: ZOOM },
  ShiftLeft: { caption: 'fast' },
  AltLeft: { caption: 'slow', dimmed: true },
  ArrowUp: { caption: 'pitch', tone: PITCH },
  ArrowDown: { caption: 'pitch', tone: PITCH },
  ArrowLeft: { caption: 'turn', tone: TURN },
  ArrowRight: { caption: 'turn', tone: TURN },
};

/** A camera's keys, marked by what they do and colored by the movement they
 *  share, drawn where they sit and no more of the keyboard than they need.
 *  Set `linger` to hide it until a key is held. */
export const Marked: Story = {
  args: { linger: 2 },
  render: function Marked({ platform = 'macos', legend, linger }) {
    const held = useHeldKeys();
    return (
      <KeyDiagram
        layout={KEYBOARD_LAYOUTS[platform]}
        keys={Object.keys(CAMERA)}
        marks={CAMERA}
        legend={legend}
        held={held}
        linger={linger || undefined}
      />
    );
  },
};

/** Without a layout the keys are drawn in a row, ungrouped. */
export const Ungrouped: Story = {
  render: function Ungrouped({ platform, legend }) {
    const held = useHeldKeys();
    return (
      <KeyDiagram
        keys={['BracketLeft', 'BracketRight', 'Escape', 'Enter', 'Home', 'End']}
        marks={{ BracketLeft: { caption: 'earlier' }, BracketRight: { caption: 'later' }, Escape: { caption: 'out' } }}
        platform={platform}
        legend={legend}
        held={held}
      />
    );
  },
};
