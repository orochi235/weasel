import { Icon } from '@weasel-js/ui/components/Icon';
import { Popover } from '@weasel-js/ui/components/Popover';
import { createContext, type ReactNode, useContext, useRef, useState } from 'react';
import { Dialog as RACDialog } from 'react-aria-components';
import type { TrialContribution } from '../chrome/types';
import { icon } from '../icons.gen';

/** What the toggle opens: the trial's sidebar sections, and the trial they belong to. */
export interface FloatSidebarValue {
  title: string;
  sections: ReactNode;
}

export const FloatSidebarContext = createContext<FloatSidebarValue | null>(null);

/** The id of the title bar's toggle for a floating sidebar. */
export const FLOAT_TOGGLE_ID = 'panel';

/** The title bar's toggle for a trial whose sidebar floats, first among the bar's trailing buttons. */
export const floatToggle: TrialContribution = {
  id: FLOAT_TOGGLE_ID,
  region: 'titlebar',
  end: true,
  render: () => <FloatSidebar />,
};

/**
 * A titlebar button opening the trial's sidebar sections in a dialog over its body, centered under the button. The body keeps its whole box
 * while the dialog is open; Escape or a press outside closes it, and focus goes back to the button.
 */
function FloatSidebar() {
  const value = useContext(FloatSidebarContext);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  if (!value) return null;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="lk-titlebar-button"
        aria-label="Trial settings"
        title="Trial settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        // The bar behind it is the tile's drag surface.
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Icon name={icon('ui:settings')} size={16} />
      </button>
      <Popover
        triggerRef={trigger}
        isOpen={open}
        onOpenChange={setOpen}
        // A press on the toggle is its own to answer; closing here as well would reopen it on the click.
        shouldCloseOnInteractOutside={(el) => !trigger.current?.contains(el)}
        placement="bottom"
        offset={4}
        className="lk-float-sidebar"
        data-weasel-overlay=""
      >
        <RACDialog className="lk-float-sidebar__body" aria-label={`${value.title} settings`}>
          {value.sections}
        </RACDialog>
      </Popover>
    </>
  );
}
