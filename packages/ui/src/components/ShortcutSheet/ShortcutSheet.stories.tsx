import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { ActionsProvider, toolSet, type Action, type Tool } from '@weasel-js/core';
import { Button } from '@weasel-js/ui/components/Button';
import { ShortcutSheet, useShortcutSheetCommand } from '@weasel-js/ui/components/ShortcutSheet';
import { RegisterActions } from '@weasel-js/routing/testing/registerAction';
import { icon } from '../../icons.gen';

const run = { timing: 'immediate' as const, run: () => {} };
const tool = (id: string, label: string, name: Parameters<typeof icon>[0]): Tool =>
  ({ id, presentation: { label, icon: icon(name) } }) as Tool;

const TOOLS: Record<string, Tool> = {
  select: tool('select', 'Select', 'core:select'),
  lasso: tool('lasso', 'Lasso', 'core:lasso'),
  rect: tool('rect', 'Rectangle', 'core:rect'),
  pen: tool('pen', 'Pen', 'core:pen'),
  hand: tool('hand', 'Hand', 'core:hand'),
};
const SETS = [toolSet('select', ['select', 'lasso'], { label: 'Select' }), toolSet('make', ['rect', 'pen'], { label: 'Make' })];
const activate = (k: string, toolId: string) => ({ spec: { kind: 'key' as const, key: k }, opts: { params: { toolId } } });

const ACTIONS: Action[] = [
  {
    id: 'tool.activate', label: 'Activate tool', invoker: run,
    defaultBinding: [activate('v', 'select'), activate('l', 'lasso'), activate('r', 'rect'), activate('p', 'pen'), activate('h', 'hand')],
  },
  {
    id: 'tool.offhand', label: 'Engage tool', scope: 'hotkey', invoker: { timing: 'ongoing', start: () => ({}) },
    defaultBinding: [{ spec: { kind: 'keyHeld', key: ' ' }, opts: { params: { toolId: 'hand' } } }],
  },
  { id: 'undo', label: 'Undo', group: 'history', invoker: run, defaultBinding: { kind: 'key', key: 'z', mods: { mod: true } } },
  { id: 'redo', label: 'Redo', group: 'history', invoker: run, defaultBinding: { kind: 'key', key: 'z', mods: { mod: true, shift: true } } },
  { id: 'duplicate', label: 'Duplicate', group: 'edit', invoker: run, defaultBinding: { kind: 'key', key: 'd', mods: { mod: true } } },
  { id: 'group', label: 'Group', group: 'arrange', invoker: run, defaultBinding: { kind: 'key', key: 'g', mods: { mod: true } } },
];

function Demo({ initiallyOpen }: { initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <ActionsProvider>
      <RegisterActions actions={ACTIONS} />
      <Command open={() => setOpen(true)} />
      <Button onClick={() => setOpen(true)}>Keyboard shortcuts</Button>
      <ShortcutSheet isOpen={open} onOpenChange={setOpen} tools={{ registry: TOOLS }} toolSets={SETS} />
    </ActionsProvider>
  );
}

function Command({ open }: { open: () => void }) {
  useShortcutSheetCommand(open);
  return null;
}

const meta: Meta<typeof Demo> = {
  title: 'ui/ShortcutSheet',
  component: Demo,
};
export default meta;

type Story = StoryObj<typeof Demo>;

export const Open: Story = { args: { initiallyOpen: true } };
export const Closed: Story = { args: { initiallyOpen: false } };
