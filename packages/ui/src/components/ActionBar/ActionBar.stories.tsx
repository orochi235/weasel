import type { Meta, StoryObj } from '@weasel-js/forge';
import type { IconRef } from '@weasel-js/icons';
import {
  ActionsProvider,
  useAction,
  type Action,
} from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { icon } from '../../icons.gen';

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

function makeAction(opts: {
  id: string;
  label: string;
  group: string;
  icon: IconRef;
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
    invoker: {
      timing: 'immediate',
      run: () => {
        // Console-only side effect — the story shows visual state, not behavior.
        console.log(`[ActionBar story] ${opts.id}`);
      },
    },
  };
}

const alignActions: Action[] = [
  makeAction({ id: 'align.left', label: 'Align Left', group: 'align', icon: icon('core:alignLeft'), shortcut: 'L' }),
  makeAction({ id: 'align.center', label: 'Align Center', group: 'align', icon: icon('core:alignCenterX'), shortcut: 'C' }),
  makeAction({ id: 'align.right', label: 'Align Right', group: 'align', icon: icon('core:alignRight'), shortcut: 'R' }),
];

const mixedEnabled: Action[] = [
  makeAction({ id: 'mix.on', label: 'Enabled', group: 'mix', icon: icon('check'), enabled: () => true }),
  makeAction({ id: 'mix.off', label: 'Disabled', group: 'mix', icon: icon('close'), enabled: () => 'selection-required' }),
  makeAction({ id: 'mix.also', label: 'Also disabled', group: 'mix', icon: icon('close'), enabled: () => 'not-applicable' }),
];

const meta: Meta<typeof ActionBar> = {
  title: 'ui/ActionBar',
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
        icons={{ 'align.center': icon('fit') }}
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
