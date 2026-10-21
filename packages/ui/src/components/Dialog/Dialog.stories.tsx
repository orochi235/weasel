import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Dialog } from '@weasel-js/ui/components/Dialog';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof Dialog> = {
  title: 'Primitives/Dialog',
  component: Dialog,
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Basic: Story = {
  args: { title: 'Preferences' },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog
          {...args}
          isOpen={open}
          onOpenChange={setOpen}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>OK</Button>
            </>
          }
        >
          <p>Dialog body. Try Escape, the close button, or clicking outside.</p>
        </Dialog>
      </>
    );
  },
};

export const AlertDialog: Story = {
  args: { role: 'alertdialog', title: 'Delete this layer?' },
  render: (args) => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Delete layer</Button>
        <Dialog
          {...args}
          isOpen={open}
          onOpenChange={setOpen}
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setOpen(false)}>Delete</Button>
            </>
          }
        >
          <p>This cannot be undone.</p>
        </Dialog>
      </>
    );
  },
};
