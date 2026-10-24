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

const TURN = { ref: 'swatch-violet' };
const MOVE = { ref: 'swatch-sky' };
const ZOOM = { ref: 'swatch-amber' };
const LIFT = { ref: 'swatch-teal' };
const PITCH = { ref: 'swatch-fuchsia' };

const CAMERA: Readonly<Record<string, KeyMark>> = {
  KeyQ: { caption: 'turn', tint: TURN },
  KeyW: { caption: 'fwd', tint: MOVE },
  KeyE: { caption: 'turn', tint: TURN },
  KeyR: { caption: 'climb', tint: LIFT },
  KeyA: { caption: 'left', tint: MOVE },
  KeyS: { caption: 'back', tint: MOVE },
  KeyD: { caption: 'right', tint: MOVE },
  KeyF: { caption: 'sink', tint: LIFT },
  KeyG: { caption: 'go to' },
  KeyZ: { caption: 'loupe' },
  KeyX: { caption: 'wide', tint: ZOOM },
  KeyC: { caption: 'close', tint: ZOOM },
  ShiftLeft: { caption: 'fast' },
  AltLeft: { caption: 'slow', dimmed: true },
  ArrowUp: { caption: 'pitch', tint: PITCH },
  ArrowDown: { caption: 'pitch', tint: PITCH },
  ArrowLeft: { caption: 'turn', tint: TURN },
  ArrowRight: { caption: 'turn', tint: TURN },
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
