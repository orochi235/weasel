import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ActionDisabledReason, ActionsProvider, type Action } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { CommandPalette } from '@weasel-js/ui/components/CommandPalette';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';

const run = (id: string) => () => { console.log(`[CommandPalette story] ${id}`); };

const ACTIONS: Action[] = [
  {
    id: 'duplicate',
    label: 'Duplicate',
    defaultBinding: { kind: 'key', key: 'd', mods: { mod: true } },
    invoker: { timing: 'immediate', run: run('duplicate') },
  },
  {
    id: 'group',
    label: 'Group',
    defaultBinding: { kind: 'key', key: 'g', mods: { mod: true } },
    invoker: { timing: 'immediate', run: run('group') },
  },
  {
    id: 'delete',
    label: 'Delete',
    enabled: () => ActionDisabledReason.SelectionRequired,
    invoker: { timing: 'immediate', run: run('delete') },
  },
  { id: 'selectAll', label: 'Select all', invoker: { timing: 'immediate', run: run('selectAll') } },
];

function Demo({ initiallyOpen }: { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <Button onClick={() => setOpen(true)}>Open commands</Button>
      <CommandPalette open={open} onClose={() => setOpen(false)} />
    </ActionsProvider>
  );
}

const meta: Meta<typeof Demo> = {
  title: 'ui/CommandPalette',
  component: Demo,
};
export default meta;

type Story = StoryObj<typeof Demo>;

export const Open: Story = { args: { initiallyOpen: true } };
export const Closed: Story = { args: { initiallyOpen: false } };
