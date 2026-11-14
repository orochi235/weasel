import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, type ReactNode } from 'react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefAction, type PrefGroup } from '@weasel-js/prefs';
import { ActionLeaf, PrefsForm } from '@weasel-js/ui/components/Prefs';
import s from '../Bar/Bar.stories.module.css';
import { icon } from '../../icons.gen';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const meta: Meta<typeof ActionLeaf> = {
  title: 'ui/Foundations/Prefs/ActionLeaf',
  component: ActionLeaf,
};
export default meta;
type Story = StoryObj<typeof ActionLeaf>;

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
      <ActionLeaf {...args} leaf={leaf({ name: 'Undo', icon: icon('core:undo'), action: 'edit.undo' })} path="undo" />
    </Host>
  ),
};

/** The action says it cannot run now. */
export const Disabled: Story = {
  render: (args) => (
    <Host actions={[{ id: 'edit.undo', label: 'Undo', invoker: immediate, enabled: () => 'not-applicable' }]}>
      <ActionLeaf {...args} leaf={leaf({ name: 'Undo', icon: icon('core:undo'), action: 'edit.undo' })} path="undo" />
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
          <ActionLeaf {...args} leaf={leaf({ name: 'Snap', action: 'view.snap', control: 'button' })} path="snap" />
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
      <ActionLeaf {...args}
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
      <ActionLeaf {...args} leaf={leaf({ name: 'Undo', icon: icon('core:undo'), action: 'edit.undo', control: 'button' })} path="undo" />
    </Host>
  ),
};

/** A key nothing registered answers to: a dead button whose tooltip names the key. */
export const UnknownKey: Story = {
  render: (args) => (
    <Host actions={[]}>
      <ActionLeaf {...args} leaf={leaf({ name: 'Flatten', action: 'layers.flatten' })} path="flatten" />
    </Host>
  ),
};

const FORM_ACTIONS: Action[] = [
  { id: 'arrange.front', label: 'Bring to front', group: 'arrange', icon: icon('core:bringToFront'), invoker: immediate },
  { id: 'arrange.back', label: 'Send to back', group: 'arrange', icon: icon('core:sendToBack'), invoker: immediate },
  { id: 'arrange.group', label: 'Group', group: 'arrange', icon: icon('core:group'), invoker: immediate, enabled: () => 'selection-required' },
  { id: 'doc.export', label: 'Export…', icon: icon('export'), invoker: immediate },
];

const SCHEMA: PrefGroup = pref.group('Document', {
  export: pref.action('doc.export'),
  arrange: pref.group('Arrange', { order: pref.actions('arrange') }, { as: 'section' }),
  broken: pref.action('doc.print', { name: 'Print' }),
  stats: pref.group('Stats', {
    nodes: { ...pref.number('Nodes', 0), readout: true },
    grid: { ...pref.boolean('Grid', false), readout: true },
    units: { ...pref.enum('Units', 'mm', ['px', 'mm', 'in']), readout: true },
    color: { ...pref.color('Background', '#ffffff'), readout: true },
  }, { as: 'section' }),
});

/** In a form an action leaf is a row reading its icon and label once. The `actions` leaf under Arrange is one row per action
 *  in its group, Group disabled with its reason in a tooltip; Print names an action nothing registered, and says
 *  so. The Stats rows are `readout` leaves: values, with nothing to edit them. */
export const InAForm: Story = {
  render: function InAFormStory() {
    const [values, setValues] = useState<Record<string, unknown>>({ stats: { nodes: 128, grid: true, units: 'mm', color: '#f4efe6' } });
    return (
      <ActionsProvider>
        <RegisterActions actions={FORM_ACTIONS} />
        <PrefsForm schema={SCHEMA} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
      </ActionsProvider>
    );
  },
};
