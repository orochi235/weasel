import type { Meta, StoryObj } from '@weasel-js/forge';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref } from '@weasel-js/prefs';
import { BarActions } from '@weasel-js/ui/components/Bar';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';
import { icon } from '../../icons.gen';
import s from './Bar.stories.module.css';

const ARRANGE: Action[] = [
  { id: 'arrange.front', label: 'Bring to front', group: 'arrange', icon: icon('core:bringToFront'), invoker: { timing: 'immediate', run: () => {} } },
  { id: 'arrange.back', label: 'Send to back', group: 'arrange', icon: icon('core:sendToBack'), invoker: { timing: 'immediate', run: () => {} } },
  {
    id: 'arrange.flip',
    label: 'Flip',
    group: 'arrange',
    invoker: { timing: 'immediate', run: () => {} },
    variants: [
      { key: 'x', label: 'Flip horizontally', icon: icon('core:flipX'), params: { axis: 'x' } },
      { key: 'y', label: 'Flip vertically', icon: icon('core:flipY'), params: { axis: 'y' } },
    ],
  },
];

const LEAF = pref.actions('arrange');

const meta: Meta<typeof BarActions> = {
  title: 'ui/Bar/BarActions',
  component: BarActions,
  args: { disabled: false },
};
export default meta;
type Story = StoryObj<typeof BarActions>;

function Host({ disabled }: { disabled?: boolean }) {
  return (
    <ActionsProvider>
      <RegisterActions actions={ARRANGE} />
      <div className={s.strip}>
        <BarActions leaf={LEAF} path="arrange" disabled={disabled} />
      </div>
    </ActionsProvider>
  );
}

/** An `actions` leaf: a button for each action registered in its group, and one for each variant of one. */
export const Default: Story = { render: (args) => <Host disabled={args.disabled} /> };

export const Disabled: Story = { args: { disabled: true }, render: (args) => <Host disabled={args.disabled} /> };
