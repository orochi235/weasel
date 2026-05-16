import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import {
  ActionsProvider,
  useAction,
  type Action,
} from '@orochi235/weasel';
import { ActionBar } from './ActionBar';

// Inline placeholder glyphs keep the story self-contained.
function Glyph({ char }: { char: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <text
        x="8"
        y="11"
        fontSize="11"
        textAnchor="middle"
        fill="currentColor"
        fontFamily="ui-monospace, monospace"
      >
        {char}
      </text>
    </svg>
  );
}

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

function makeAction(opts: {
  id: string;
  label: string;
  group: string;
  icon: ReactNode;
  enabled?: () => true | 'selection-required' | 'scene-empty' | 'not-applicable';
  shortcut?: string;
}): Action {
  return {
    id: opts.id,
    label: opts.label,
    group: opts.group,
    icon: opts.icon,
    shortcut: opts.shortcut,
    enabled: opts.enabled,
    run: () => {
      // Console-only side effect — the story shows visual state, not behavior.
      // eslint-disable-next-line no-console
      console.log(`[ActionBar story] ${opts.id}`);
    },
  };
}

const alignActions: Action[] = [
  makeAction({ id: 'align.left', label: 'Align Left', group: 'align', icon: <Glyph char="←" />, shortcut: 'L' }),
  makeAction({ id: 'align.center', label: 'Align Center', group: 'align', icon: <Glyph char="↔" />, shortcut: 'C' }),
  makeAction({ id: 'align.right', label: 'Align Right', group: 'align', icon: <Glyph char="→" />, shortcut: 'R' }),
];

const mixedEnabled: Action[] = [
  makeAction({ id: 'mix.on', label: 'Enabled', group: 'mix', icon: <Glyph char="✓" />, enabled: () => true }),
  makeAction({ id: 'mix.off', label: 'Disabled', group: 'mix', icon: <Glyph char="×" />, enabled: () => 'selection-required' }),
  makeAction({ id: 'mix.also', label: 'Also disabled', group: 'mix', icon: <Glyph char="×" />, enabled: () => 'not-applicable' }),
];

const meta: Meta<typeof ActionBar> = {
  title: 'weasel-ui/ActionBar',
  component: ActionBar,
};
export default meta;

type Story = StoryObj<typeof ActionBar>;

export const Default: Story = {
  render: () => (
    <ActionsProvider>
      {alignActions.map((a) => (
        <Register key={a.id} action={a} />
      ))}
      <ActionBar group="align" />
    </ActionsProvider>
  ),
};

export const Vertical: Story = {
  render: () => (
    <ActionsProvider>
      {alignActions.map((a) => (
        <Register key={a.id} action={a} />
      ))}
      <ActionBar group="align" orientation="vertical" />
    </ActionsProvider>
  ),
};

export const MixedEnabledState: Story = {
  render: () => (
    <ActionsProvider>
      {mixedEnabled.map((a) => (
        <Register key={a.id} action={a} />
      ))}
      <ActionBar group="mix" />
    </ActionsProvider>
  ),
};

export const WithIconAndLabelOverrides: Story = {
  render: () => (
    <ActionsProvider>
      {alignActions.map((a) => (
        <Register key={a.id} action={a} />
      ))}
      <ActionBar
        group="align"
        icons={{ 'align.center': <Glyph char="○" /> }}
        labels={{ 'align.center': 'Center on canvas' }}
      />
    </ActionsProvider>
  ),
};

export const EmptyGroup: Story = {
  render: () => (
    <ActionsProvider>
      {alignActions.map((a) => (
        <Register key={a.id} action={a} />
      ))}
      <ActionBar group="this-group-has-no-actions" />
    </ActionsProvider>
  ),
};
