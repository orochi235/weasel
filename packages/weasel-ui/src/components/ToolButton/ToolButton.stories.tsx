import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ToolButton } from './ToolButton';
import { ToolGroup } from '../ToolGroup';

// Inline placeholder icons keep the story free of cross-package imports
// and focus the visual on the button chrome itself, not specific glyphs.
function CursorGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path d="M4 2 L4 14 L7.5 11 L9.5 16 L11.5 15.2 L9.5 10.2 L14 10 Z" />
    </svg>
  );
}
function SquareGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3.5" y="3.5" width="13" height="13" />
    </svg>
  );
}
function CircleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" />
    </svg>
  );
}

const meta: Meta<typeof ToolButton> = {
  title: 'weasel-ui/ToolButton',
  component: ToolButton,
  args: {
    icon: <CursorGlyph />,
    label: 'Select',
    shortcut: 'V',
    tabbable: true,
    onClick: () => {},
  },
};
export default meta;

type Story = StoryObj<typeof ToolButton>;

export const Default: Story = {};
export const Active: Story = { args: { active: true } };
export const Disabled: Story = { args: { disabled: true } };
export const NoShortcut: Story = { args: { shortcut: undefined } };

// Renders the button as toolbar consumers would: inside a ToolGroup with
// roving tabindex managed by the parent.
function InGroupExample() {
  const [active, setActive] = useState<'select' | 'rect' | 'ellipse'>('select');
  const tools: Array<{ id: 'select' | 'rect' | 'ellipse'; label: string; icon: React.ReactNode; shortcut: string }> = [
    { id: 'select', label: 'Select', icon: <CursorGlyph />, shortcut: 'V' },
    { id: 'rect', label: 'Rectangle', icon: <SquareGlyph />, shortcut: 'R' },
    { id: 'ellipse', label: 'Ellipse', icon: <CircleGlyph />, shortcut: 'O' },
  ];
  return (
    <ToolGroup>
      {tools.map((t) => (
        <ToolButton
          key={t.id}
          icon={t.icon}
          label={t.label}
          shortcut={t.shortcut}
          active={active === t.id}
          tabbable={active === t.id}
          onClick={() => setActive(t.id)}
        />
      ))}
    </ToolGroup>
  );
}

export const InGroup: Story = {
  render: () => <InGroupExample />,
};
