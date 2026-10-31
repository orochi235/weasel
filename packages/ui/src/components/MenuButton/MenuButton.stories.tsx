import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';

const meta: Meta<typeof MenuButton> = {
  title: 'ui/Foundations/MenuButton',
  component: MenuButton,
};
export default meta;

type Story = StoryObj<typeof MenuButton>;

const INSTRUMENTS = [
  { value: 'sine', label: 'Sine wave' },
  { value: 'garden', label: 'Garden planner with a long name' },
  { value: 'annotate', label: 'Annotate' },
];

/** The button sizes to "Add trial…" however long a row is; the list is as
 *  wide as its widest row. */
export const AddTrial: Story = {
  args: { label: 'Add trial…', items: INSTRUMENTS },
  render: (args) => {
    const [added, setAdded] = useState<string[]>([]);
    return (
      <div>
        <MenuButton {...args} onAction={(value) => setAdded((a) => [...a, value])} />
        <p>Added: {added.join(', ') || 'nothing yet'}</p>
      </div>
    );
  },
};

/** `current` marks the label as a value the caller holds: it reads in the
 *  text color, and the button is as wide as that value. */
export const ReadsItsValue: Story = {
  args: { current: true, items: INSTRUMENTS },
  render: (args) => {
    const [held, setHeld] = useState('sine');
    return (
      <MenuButton
        {...args}
        label={INSTRUMENTS.find((i) => i.value === held)!.label}
        onAction={setHeld}
      />
    );
  },
};

/** `shortcut` hovers as `New (⌘N)`; `tooltip` replaces that text with a
 *  longer hint for a label too terse to say what the menu holds. */
export const Tooltips: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12 }}>
      <MenuButton {...args} label="New" shortcut="⌘N" items={INSTRUMENTS} onAction={() => {}} />
      <MenuButton {...args} label="Debug" tooltip="Debug surfaces" items={INSTRUMENTS} onAction={() => {}} />
    </div>
  ),
};

const PAGES = [
  { value: 'wall', label: 'Wall', href: '#wall' },
  { value: 'stats', label: 'Dashboard', href: '#stats', isCurrent: true },
  { value: 'ingest', label: 'Ingestion', href: '#ingest' },
];

/** A row with an `href` is a link, and `isCurrent` marks the page that is
 *  open. `bare` drops the field frame, so a heading can be the trigger. */
export const HeadingOfLinks: Story = {
  render: (args) => (
    <h1>
      <MenuButton {...args} bare label="Dashboard" items={PAGES} />
    </h1>
  ),
};
