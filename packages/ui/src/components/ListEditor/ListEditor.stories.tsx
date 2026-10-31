import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { PropertyControl } from '@weasel-js/ui/components/Properties';
import { ListEditor, type ListEditorProps } from '@weasel-js/ui/components/ListEditor';

const meta: Meta<typeof ListEditor> = {
  title: 'ui/ListEditor',
  component: ListEditor,
};
export default meta;

type Story = StoryObj<typeof ListEditor>;

function Strings({ args, reorder }: { args: Story['args']; reorder?: boolean }): ReactElement {
  const [value, setValue] = useState(['*.ts', '*.tsx', '!*.test.ts']);
  return <ListEditor {...(args as ListEditorProps)} aria-label="Glob" value={value} onChange={setValue} reorder={reorder} placeholder="pattern" />;
}

/** Strings, each a text field: Enter adds one after, Backspace in an empty one removes it. */
export const Default: Story = {
  render: (args) => <Strings args={args} />,
};

/** Drag an entry by its handle, or press Alt+Up / Alt+Down anywhere in it. */
export const Reorder: Story = {
  render: (args) => <Strings args={args} reorder />,
};

type Mark = { kind: 'hit' | 'cue'; at: number };

function Marks({ args }: { args: Story['args'] }): ReactElement {
  const [value, setValue] = useState<Mark[]>([{ kind: 'hit', at: 0 }]);
  return (
    <ListEditor<Mark>
      {...args}
      aria-label="Mark"
      addLabel="Add mark"
      reorder
      value={value}
      onChange={setValue}
      newEntry={[
        { label: 'Hit', make: () => ({ kind: 'hit', at: 0 }) },
        { label: 'Cue', make: () => ({ kind: 'cue', at: 0 }) },
      ]}
      renderEntry={(entry, set, name) => (
        <PropertyControl
          kind="number"
          name={`${name}, ${entry.kind}`}
          unit={entry.kind}
          value={entry.at}
          onChange={(at) => set({ ...entry, at })}
        />
      )}
    />
  );
}

/** Several kinds of new entry make the add button a menu of them. */
export const EntryKinds: Story = {
  render: (args) => <Marks args={args} />,
};
