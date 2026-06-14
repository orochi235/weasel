import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { Dialog } from './Dialog';
import { Button } from '../Button';

const meta: Meta<typeof Dialog> = {
  title: 'Primitives/Dialog',
  component: Dialog,
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Basic: Story = {
  render: () => {
    function Wrap() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open dialog</Button>
          <Dialog
            isOpen={open}
            onOpenChange={setOpen}
            title="Preferences"
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
    }
    return <Wrap />;
  },
};

export const AlertDialog: Story = {
  render: () => {
    function Wrap() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Delete layer</Button>
          <Dialog
            isOpen={open}
            onOpenChange={setOpen}
            role="alertdialog"
            title="Delete this layer?"
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
    }
    return <Wrap />;
  },
};
