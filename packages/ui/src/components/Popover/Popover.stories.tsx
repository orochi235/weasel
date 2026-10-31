import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Button, Dialog, DialogTrigger } from 'react-aria-components';
import { Popover } from '@weasel-js/ui/components/Popover';
import { useOverlayPortal } from '@weasel-js/ui/portal-host';
import s from './Popover.stories.module.css';

const meta: Meta<typeof Popover> = {
  title: 'ui/Foundations/Popover',
  component: Popover,
};
export default meta;

type Story = StoryObj<typeof Popover>;

/** A box drawn at twice its size, as a magnifier draws its copy: the popover opens against its button, at 2× too. */
export const InAMagnifiedBox: Story = {
  render: (args) => {
    function Magnified() {
      const [box, setBox] = useState<HTMLDivElement | null>(null);
      const { anchor, provide } = useOverlayPortal(box);
      return (
        <div ref={setBox} className={s.magnified}>
          {anchor}
          {box ? (
            <DialogTrigger>
              <Button>Open</Button>
              {provide(
                <Popover {...args} placement="bottom" offset={8}>
                  <Dialog aria-label="Popover" className={s.panel}>
                    Opens under its button.
                  </Dialog>
                </Popover>,
              )}
            </DialogTrigger>
          ) : null}
        </div>
      );
    }
    return <Magnified />;
  },
};
