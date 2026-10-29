import type { Meta, StoryObj } from '@weasel-js/forge';
import { useRef, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { Callout, CalloutTrigger } from '@weasel-js/ui/components/Callout';
import { Button } from '@weasel-js/ui/components/Button';

const meta: Meta<typeof Callout> = {
  title: 'ui/Foundations/Callout',
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
        <button type="button">What does this do?</button>
      </Pressable>
      <Callout {...args} />
    </CalloutTrigger>
  ),
};

export const Grades: Story = {
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
          <Callout triggerRef={infoRef} isOpen={open === 'info'} onOpenChange={(o) => !o && setOpen(null)} grade="info" title="Info">Neutral guidance.</Callout>
          <Callout triggerRef={warnRef} isOpen={open === 'warning'} onOpenChange={(o) => !o && setOpen(null)} grade="warn" title="Warning">Something needs attention.</Callout>
          <Callout triggerRef={dangerRef} isOpen={open === 'danger'} onOpenChange={(o) => !o && setOpen(null)} grade="danger" title="Danger">Destructive consequence ahead.</Callout>
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
        <button ref={ref} type="button" onClick={() => setOpen(true)}>Delete everything</button>
        <Callout
          {...args}
          triggerRef={ref}
          isOpen={open}
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
