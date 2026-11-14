import { useRef, useState } from 'react';
import { Popover, PopoverDialog } from '../Popover';
import { useOverlayPortal } from '../../overlays/portalHost';
import { ActionButton, type ActionButtonProps } from '../ActionButton/ActionButton';
import { FormScope } from '../ActionButton/controlForm';
import { PrefsForm } from '../Prefs/PrefsForm';
import type { ActionSettingsForm } from './useActionSettings';
import bar from '../Bar/Bar.module.css';
import s from './ActionSettings.module.css';

/** Props for {@link ActionSettingsPopover}: the action's button, less what opening the form decides. */
export interface ActionSettingsPopoverProps extends Omit<ActionButtonProps, 'onPress' | 'popup'> {
  settings: ActionSettingsForm;
}

/**
 * An action carrying settings, as a bar's or a panel's button: pressing it
 * opens the form in a popover under it rather than triggering the action, and
 * each change in the form triggers it. Disabled as the action is, so a form
 * with nothing to edit never opens.
 */
export function ActionSettingsPopover({ settings, ...button }: ActionSettingsPopoverProps) {
  const trigger = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const { anchor, provide, ready } = useOverlayPortal();
  const available = !button.disabled && button.missing === undefined;
  // The action going away closes the form for good, so its coming back does not reopen it unasked.
  if (open && !available) setOpen(false);
  const shown = open && available;
  return (
    <>
      <span ref={trigger} className={s.trigger}>
        {anchor}
        <ActionButton {...button} popup={{ type: 'dialog', expanded: shown }} onPress={() => setOpen((was) => !was)} />
      </span>
      {ready && provide(
        <Popover
          triggerRef={trigger}
          isOpen={shown}
          onOpenChange={setOpen}
          placement="bottom start"
          className={bar.popover}
          data-weasel-overlay=""
        >
          <PopoverDialog className={`${bar.popBody} ${s.body}`} aria-label={settings.schema.name || button.label}>
            {settings.schema.name && <p className={s.title}>{settings.schema.name}</p>}
            <FormScope form="popover">
              <PrefsForm schema={settings.schema} layout="list" values={settings.values} mixed={settings.mixed} onChange={settings.onChange} />
            </FormScope>
          </PopoverDialog>
        </Popover>,
      )}
    </>
  );
}
