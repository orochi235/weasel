import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { MenuButton } from './MenuButton';

const meta: Meta<typeof MenuButton> = {
  title: 'Primitives/MenuButton',
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
  render: () => {
    const [added, setAdded] = useState<string[]>([]);
    return (
      <div>
        <MenuButton
          label="Add trial…"
          items={INSTRUMENTS}
          onAction={(value) => setAdded((a) => [...a, value])}
        />
        <p>Added: {added.join(', ') || 'nothing yet'}</p>
      </div>
    );
  },
};

/** `shortcut` hovers as `New (⌘N)`; `tooltip` replaces that text with a
 *  longer hint for a label too terse to say what the menu holds. */
export const Tooltips: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <MenuButton label="New" shortcut="⌘N" items={INSTRUMENTS} onAction={() => {}} />
      <MenuButton label="Debug" tooltip="Debug surfaces" items={INSTRUMENTS} onAction={() => {}} />
    </div>
  ),
};
