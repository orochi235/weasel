import { useState, type ReactElement } from 'react';
import type { Meta, StoryObj } from '@weasel-js/forge';
import { Input } from '@weasel-js/ui/components/Input';
import { TokenField, type TokenFieldProps } from '@weasel-js/ui/components/TokenField';

const meta: Meta<typeof TokenField> = {
  title: 'ui/TokenField',
  component: TokenField,
};
export default meta;

type Story = StoryObj<typeof TokenField>;

function Strings({ args, reorder }: { args: Story['args']; reorder?: boolean }): ReactElement {
  const [value, setValue] = useState(['*.ts', '*.tsx', '!*.test.ts', 'src/**', 'packages/*/src/**']);
  return <TokenField {...(args as TokenFieldProps)} aria-label="Glob" value={value} onChange={setValue} reorder={reorder} placeholder="Add a pattern" />;
}

/** Type and press Enter or a comma to add; click a chip to edit it. Left, Right and Backspace move through them. */
export const Default: Story = {
  render: (args) => <Strings args={args} />,
};

/** Drag a chip into place, across lines as they wrap, or press Alt+Left / Alt+Right on one. */
export const Reorder: Story = {
  render: (args) => <Strings args={args} reorder />,
};

type Option = { value: string; label: string };

function Options({ args }: { args: Story['args'] }): ReactElement {
  const [value, setValue] = useState<Option[]>([
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
    { value: 'lg', label: 'Huge' },
  ]);
  return (
    <TokenField<Option>
      {...args}
      aria-label="Option"
      reorder
      value={value}
      onChange={setValue}
      label={(o) => o.label || o.value}
      tooltip={(o) => o.value}
      create={(text) => ({ value: text, label: text })}
      problem={(all, i) => (all.findIndex((o) => o.value === all[i]!.value) < i ? 'Repeats an earlier value' : undefined)}
      renderEditor={(o, set) => (
        <>
          <Input label="Value stored" value={o.value} onChange={(v) => set({ ...o, value: v })} />
          <Input label="Label shown" value={o.label} onChange={(v) => set({ ...o, label: v })} />
        </>
      )}
    />
  );
}

/** Tokens that are not strings: the chip shows a label, its tooltip the value, and a popover edits both. */
export const Records: Story = {
  render: (args) => <Options args={args} />,
};
