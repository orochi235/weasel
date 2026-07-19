import type { Meta, StoryObj } from '@storybook/react';
import { useRef, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { Callout, CalloutTrigger } from './Callout';
import { Button } from '../Button';

const meta: Meta<typeof Callout> = {
  title: 'Primitives/Callout',
  component: Callout,
};
export default meta;

type Story = StoryObj<typeof Callout>;

export const Composed: Story = {
  render: () => (
    <CalloutTrigger>
      <Pressable>
        <button type="button">What does this do?</button>
      </Pressable>
      <Callout title="Boolean union" placement="bottom">
        Merges the selected paths into a single shape. Original paths are
        replaced; undo restores them.
      </Callout>
    </CalloutTrigger>
  ),
};

export const Tones: Story = {
  render: () => {
    function Row() {
      const infoRef = useRef<HTMLButtonElement>(null);
      const warnRef = useRef<HTMLButtonElement>(null);
      const dangerRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState<'info' | 'warning' | 'danger' | null>('info');
      return (
        <>
          <button ref={infoRef} type="button" onClick={() => setOpen('info')}>info</button>
          <button ref={warnRef} type="button" onClick={() => setOpen('warning')}>warning</button>
          <button ref={dangerRef} type="button" onClick={() => setOpen('danger')}>danger</button>
          <Callout triggerRef={infoRef} isOpen={open === 'info'} onOpenChange={(o) => !o && setOpen(null)} tone="info" title="Info">Neutral guidance.</Callout>
          <Callout triggerRef={warnRef} isOpen={open === 'warning'} onOpenChange={(o) => !o && setOpen(null)} tone="warning" title="Warning">Something needs attention.</Callout>
          <Callout triggerRef={dangerRef} isOpen={open === 'danger'} onOpenChange={(o) => !o && setOpen(null)} tone="danger" title="Danger">Destructive consequence ahead.</Callout>
        </>
      );
    }
    return <Row />;
  },
};

export const Modal: Story = {
  render: () => {
    function Subject() {
      const ref = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button ref={ref} type="button" onClick={() => setOpen(true)}>Delete everything</button>
          <Callout
            triggerRef={ref}
            isOpen={open}
            onOpenChange={setOpen}
            modal
            tone="danger"
            title="Really delete?"
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={() => setOpen(false)}>Delete</Button>
              </>
            }
          >
            This clears the whole document. The app is blocked until you choose.
          </Callout>
        </>
      );
    }
    return <Subject />;
  },
};
