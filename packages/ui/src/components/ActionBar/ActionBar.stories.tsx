import type { Meta, StoryObj } from '@weasel-js/forge';
import type { IconRef } from '@weasel-js/icons';
import {
  ActionsProvider,
  type Action,
} from '@weasel-js/core';
import { ActionBar, type ActionBarOptions } from '@weasel-js/ui/components/ActionBar';
import { icon } from '../../icons.gen';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

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
  render: (args) => (
    <ActionsProvider>
      <RegisterActions actions={alignActions} />
      <ActionBar {...(args as ActionBarOptions)} group="align" />
    </ActionsProvider>
  ),
};

export const Vertical: Story = {
  render: (args) => (
    <ActionsProvider>
      <RegisterActions actions={alignActions} />
      <ActionBar {...(args as ActionBarOptions)} group="align" orientation="vertical" />
    </ActionsProvider>
  ),
};

export const MixedEnabledState: Story = {
  render: (args) => (
    <ActionsProvider>
      <RegisterActions actions={mixedEnabled} />
      <ActionBar {...(args as ActionBarOptions)} group="mix" />
    </ActionsProvider>
  ),
};

export const WithIconAndLabelOverrides: Story = {
  render: (args) => (
    <ActionsProvider>
      <RegisterActions actions={alignActions} />
      <ActionBar {...(args as ActionBarOptions)}
        group="align"
        icons={{ 'align.center': icon('fit') }}
        labels={{ 'align.center': 'Center on canvas' }}
      />
    </ActionsProvider>
  ),
};

export const EmptyGroup: Story = {
  render: (args) => (
    <ActionsProvider>
      <RegisterActions actions={alignActions} />
      <ActionBar {...(args as ActionBarOptions)} group="this-group-has-no-actions" />
    </ActionsProvider>
  ),
};
