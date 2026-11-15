import type { Meta, StoryObj } from '@weasel-js/forge';
import { useRef, useState } from 'react';
import { Pressable } from '@weasel-js/ui/components/Pressable';
import { Callout, CalloutTrigger } from '@weasel-js/ui/components/Callout';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof Callout> = {
  title: 'ui/Callout',
  component: Callout,
};
export default meta;

type Story = StoryObj<typeof Callout>;

export const Composed: Story = {
  args: {
    title: 'Boolean union',
    placement: 'bottom',
    children:
      'Merges the selected paths into a single shape. Original paths are replaced; undo restores them.',
  },
  render: (args) => (
    <CalloutTrigger>
      <Pressable>
        <Button variant="ghost">What does this do?</Button>
      </Pressable>
      <Callout {...args} />
    </CalloutTrigger>
  ),
};

export const Grades: Story = {
  render: (args) => {
    function Row() {
      const infoRef = useRef<HTMLButtonElement>(null);
      const warnRef = useRef<HTMLButtonElement>(null);
      const dangerRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState<'info' | 'warning' | 'danger' | null>('info');
      return (
        <>
          <Button ref={infoRef} variant="ghost" onClick={() => setOpen('info')}>info</Button>
          <Button ref={warnRef} variant="ghost" onClick={() => setOpen('warning')}>warning</Button>
          <Button ref={dangerRef} variant="ghost" onClick={() => setOpen('danger')}>danger</Button>
          <Callout {...args} triggerRef={infoRef} open={open === 'info'} onOpenChange={(o) => !o && setOpen(null)} grade="info" title="Info">Neutral guidance.</Callout>
          <Callout {...args} triggerRef={warnRef} open={open === 'warning'} onOpenChange={(o) => !o && setOpen(null)} grade="warn" title="Warning">Something needs attention.</Callout>
          <Callout {...args} triggerRef={dangerRef} open={open === 'danger'} onOpenChange={(o) => !o && setOpen(null)} grade="danger" title="Danger">Destructive consequence ahead.</Callout>
        </>
      );
    }
    return <Row />;
  },
};

export const Modal: Story = {
  args: {
    modal: true,
    grade: 'danger',
    title: 'Really delete?',
    children: 'This clears the whole document. The app is blocked until you choose (or press Esc).',
  },
  render: (args) => {
    const ref = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button ref={ref} grade="danger" onClick={() => setOpen(true)}>Delete everything</Button>
        <Callout
          {...args}
          triggerRef={ref}
          open={open}
          onOpenChange={setOpen}
          footer={
            <>
              <Button size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button stance="confirm" size="sm" onClick={() => setOpen(false)}>Delete</Button>
            </>
          }
        />
      </>
    );
  },
};
