import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Button, Dialog, DialogTrigger } from 'react-aria-components';
import { UNSAFE_PortalProvider } from 'react-aria';
import { Popover } from '@weasel-js/ui/components/Popover';
import s from './Popover.stories.module.css';

const meta: Meta<typeof Popover> = {
  title: 'Primitives/Popover',
  component: Popover,
};
export default meta;

type Story = StoryObj<typeof Popover>;

/** A box drawn at twice its size, as a magnifier draws its copy: the popover opens against its button, at 2× too. */
export const InAMagnifiedBox: Story = {
  render: () => {
    function Magnified() {
      const [box, setBox] = useState<HTMLDivElement | null>(null);
      return (
        <div ref={setBox} className={s.magnified}>
          {box ? (
            <UNSAFE_PortalProvider getContainer={() => box}>
              <DialogTrigger>
                <Button>Open</Button>
                <Popover placement="bottom" offset={8}>
                  <Dialog aria-label="Popover" className={s.panel}>
                    Opens under its button.
                  </Dialog>
                </Popover>
              </DialogTrigger>
            </UNSAFE_PortalProvider>
          ) : null}
        </div>
      );
    }
    return <Magnified />;
  },
};
