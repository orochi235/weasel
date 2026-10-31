import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, type ReactNode } from 'react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import type { PrefAction } from '@weasel-js/prefs';
import { BarAction } from '@weasel-js/ui/components/Bar';
import s from './Bar.stories.module.css';
import { icon } from '../../icons.gen';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const meta: Meta<typeof BarAction> = {
  title: 'ui/Bar/BarAction',
  component: BarAction,
};
export default meta;
type Story = StoryObj<typeof BarAction>;

const leaf = (rest: Partial<PrefAction> & Pick<PrefAction, 'name'>): PrefAction => ({
  kind: 'action',
  description: '',
  default: undefined,
  ...rest,
});

function Host({ actions, children }: { actions: Action[]; children: ReactNode }) {
  return (
    <ActionsProvider>
      <RegisterActions actions={actions} />
      <div className={s.strip}>{children}</div>
    </ActionsProvider>
  );
}

const run = (): void => {};
const immediate = { timing: 'immediate', run } as const;

/** A registered action fired by key, under the leaf's own name and icon. */
export const Enabled: Story = {
  render: (args) => (
    <Host actions={[{ id: 'edit.undo', label: 'Undo', shortcut: '⌘Z', invoker: immediate }]}>
      <BarAction {...args} leaf={leaf({ name: 'Undo', icon: icon('core:undo'), action: 'edit.undo' })} path="undo" />
    </Host>
  ),
};

/** The action says it cannot run now. */
export const Disabled: Story = {
  render: (args) => (
    <Host actions={[{ id: 'edit.undo', label: 'Undo', invoker: immediate, enabled: () => 'not-applicable' }]}>
      <BarAction {...args} leaf={leaf({ name: 'Undo', icon: icon('core:undo'), action: 'edit.undo' })} path="undo" />
    </Host>
  ),
};

/** An action that reports `active` holds its button down. */
export const Pressed: Story = {
  render: (args) => {
    function Snap() {
      const [on, setOn] = useState(true);
      return (
        <Host actions={[{ id: 'view.snap', label: 'Snap', invoker: { timing: 'immediate', run: () => setOn((v) => !v) }, active: () => on }]}>
          <BarAction {...args} leaf={leaf({ name: 'Snap', action: 'view.snap', control: 'button' })} path="snap" />
        </Host>
      );
    }
    return <Snap />;
  },
};

/** A `run` leaf waits out the promise it returned. */
export const Pending: Story = {
  render: (args) => (
    <Host actions={[]}>
      <BarAction {...args}
        leaf={leaf({ name: 'Export', control: 'button', run: () => new Promise((done) => setTimeout(done, 1500)) })}
        path="export"
      />
    </Host>
  ),
};

/** `control: 'button'` reads the label beside the icon. */
export const Labeled: Story = {
  render: (args) => (
    <Host actions={[{ id: 'edit.undo', label: 'Undo', invoker: immediate }]}>
      <BarAction {...args} leaf={leaf({ name: 'Undo', icon: icon('core:undo'), action: 'edit.undo', control: 'button' })} path="undo" />
    </Host>
  ),
};

/** A key nothing registered answers to: a dead button whose tooltip names the key. */
export const UnknownKey: Story = {
  render: (args) => (
    <Host actions={[]}>
      <BarAction {...args} leaf={leaf({ name: 'Flatten', action: 'layers.flatten' })} path="flatten" />
    </Host>
  ),
};
