import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { DialogRow, PropertyList } from '@weasel-js/ui/components/Properties';

const meta: Meta<typeof DialogRow> = {
  title: 'ui/Properties/Rows/DialogRow',
  component: DialogRow,
};
export default meta;
type Story = StoryObj<typeof DialogRow>;

/** The body edits the value as it goes; Done and Escape both just close. */
export const Live: Story = {
  render: (args) => {
    const [text, setText] = useState('a, b');
    return (
      <PropertyList>
        <DialogRow {...args} label="Globs" summary={text}>
          {() => <textarea aria-label="Globs" value={text} onChange={(e) => setText(e.target.value)} />}
        </DialogRow>
      </PropertyList>
    );
  },
};

/** The body edits a draft: Done keeps it, and Cancel or Escape drops it. */
export const Cancelable: Story = {
  render: (args) => {
    const [text, setText] = useState('a, b');
    const [draft, setDraft] = useState(text);
    return (
      <PropertyList>
        <DialogRow {...args}
          label="Globs"
          summary={text}
          onOpen={() => setDraft(text)}
          onDone={() => setText(draft)}
          onCancel={() => setDraft(text)}
        >
          {() => <textarea aria-label="Globs" value={draft} onChange={(e) => setDraft(e.target.value)} />}
        </DialogRow>
      </PropertyList>
    );
  },
};
