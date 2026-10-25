import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ActionsProvider, type Action } from '@weasel-js/core';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { MenuBar, type MenuBarProps } from '@weasel-js/ui/components/MenuBar';
import s from './MenuBar.stories.module.css';
import { RegisterActions } from '../../testing/registerAction';

const meta: Meta<typeof MenuBar> = {
  title: 'ui/MenuBar',
  component: MenuBar,
};
export default meta;
type Story = StoryObj<typeof MenuBar>;

const act = (id: string, label: string): Action => ({ id, label, invoker: { timing: 'immediate', run: () => {} } });
const ACTIONS: Action[] = [
  act('file.new', 'New'), act('file.open', 'Open…'), act('file.save', 'Save'),
  act('edit.undo', 'Undo'), act('edit.redo', 'Redo'), act('edit.cut', 'Cut'), act('edit.copy', 'Copy'),
];

const SCHEMA: PrefGroup = pref.group('', {
  file: {
    ...pref.group('File', { new: pref.action('file.new'), open: pref.action('file.open'), save: pref.action('file.save') }, { as: 'menu' }),
    access: 'f',
  },
  edit: pref.group('Edit', {
    history: pref.group('', { undo: pref.action('edit.undo'), redo: pref.action('edit.redo') }),
    clip: pref.group('', { cut: pref.action('edit.cut'), copy: pref.action('edit.copy') }),
  }, { as: 'menu' }),
  zoom: { ...pref.number('Zoom', 100, { description: 'A leaf between menus, drawn as a bar draws it.' }), readout: true },
  view: {
    ...pref.group('View', {
      grid: pref.boolean('Grid', true),
      rulers: pref.boolean('Rulers', false),
      units: pref.enum('Units', 'px', ['px', 'mm', 'in']),
    }, { as: 'menu' }),
    access: 'v',
  },
});

function AppMenuBar(args: Partial<MenuBarProps>) {
  const [values, setValues] = useState<Record<string, unknown>>({ zoom: 150, 'view.grid': true, 'view.units': 'px' });
  return (
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <div className={s.strip}>
        <MenuBar {...args} schema={SCHEMA} values={values} onChange={(path, value) => setValues((v) => ({ ...v, [path]: value }))} />
      </div>
    </ActionsProvider>
  );
}

/** File, Edit and View as titles, with a readout between Edit and View. File and View declare access letters,
 *  drawn underlined; Edit declares none. Press a title and drag to a row to run it, or walk the titles with the
 *  arrow keys. */
export const FileEditView: Story = { render: (args) => <AppMenuBar {...args} /> };
