import { useState } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { PrefActionButton, PrefsForm } from '@weasel-js/ui/components/Prefs';
import { icon } from '../../icons.gen';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const meta: Meta<typeof PrefActionButton> = {
  title: 'ui/Foundations/Prefs',
  component: PrefActionButton,
};
export default meta;

type Story = StoryObj<typeof PrefActionButton>;

const run = { timing: 'immediate', run: () => {} } as const;
const ACTIONS: Action[] = [
  { id: 'arrange.front', label: 'Bring to front', group: 'arrange', icon: icon('core:bringToFront'), invoker: run },
  { id: 'arrange.back', label: 'Send to back', group: 'arrange', icon: icon('core:sendToBack'), invoker: run },
  { id: 'arrange.group', label: 'Group', group: 'arrange', icon: icon('core:group'), invoker: run, enabled: () => 'selection-required' },
  { id: 'doc.export', label: 'Export…', icon: icon('export'), invoker: run },
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

/** An action leaf is a row reading its icon and label once. The `actions` leaf under Arrange is one row per action
 *  in its group, Group disabled with its reason in a tooltip; Print names an action nothing registered, and says
 *  so. The Stats rows are `readout` leaves: values, with nothing to edit them. */
export const ActionRows: Story = {
  render: function InAFormStory() {
    const [values, setValues] = useState<Record<string, unknown>>({ stats: { nodes: 128, grid: true, units: 'mm', color: '#f4efe6' } });
    return (
      <ActionsProvider>
        <RegisterActions actions={ACTIONS} />
        <PrefsForm schema={SCHEMA} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
      </ActionsProvider>
    );
  },
};
