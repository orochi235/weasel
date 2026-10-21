import type { Meta, StoryObj } from '@weasel-js/forge';
import {
  ActionsProvider,
  createKeymapStack,
  DepRegistryProvider,
  held,
  key,
  useAction,
  useDepSource,
  type Action,
  type GestureBinding,
} from '@weasel-js/core';
import { useState } from 'react';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';

const ACTIONS: readonly Action[] = [
  { id: 'zoomIn', label: 'Zoom in' },
  { id: 'zoomOut', label: 'Zoom out' },
  { id: 'pin', label: 'Pin the lens' },
  { id: 'peek', label: 'Peek at the source' },
];

const BINDINGS: readonly GestureBinding[] = [
  { spec: key('='), actionId: 'zoomIn' },
  { spec: key('-'), actionId: 'zoomOut' },
  { spec: { kind: 'click', mods: { shift: true } }, actionId: 'pin' },
  { spec: held('Space'), actionId: 'peek' },
];

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

/** A keymap labeled `label`, open, with a key, a pointer and a held binding. */
function Open({ label }: { label: string }) {
  const [stack] = useState(() => {
    const s = createKeymapStack();
    s.push('demo', label, { bindings: BINDINGS });
    return s;
  });
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        <Deps stack={stack} />
        {ACTIONS.map((a) => <Register key={a.id} action={a} />)}
        <KeymapHint />
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function Deps({ stack }: { stack: ReturnType<typeof createKeymapStack> }) {
  useDepSource('keymaps', () => stack);
  return null;
}

const meta: Meta<typeof Open> = {
  title: 'ui/KeymapHint',
  component: Open,
  args: { label: 'Loupe' },
};
export default meta;

type Story = StoryObj<typeof Open>;

/** An open keymap: Escape first, then a key, a modified click, and a held key. */
export const Opened: Story = {};
