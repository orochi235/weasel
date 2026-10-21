import { useRef, useState } from 'react';
import { Dialog as RACDialog, Popover as RACPopover } from 'react-aria-components';
import { useOverlayPortal } from '../../overlays/portalHost';
import { BarActionButton, type BarActionButtonProps } from '../Bar/BarAction';
import { PrefsForm } from '../Prefs/PrefsForm';
import type { ActionSettingsForm } from './useActionSettings';
import bar from '../Bar/Bar.module.css';
import listbox from '../listbox.module.css';
import s from './ActionSettings.module.css';

/** Props for {@link ActionSettingsPopover}: the action's button, less what opening the form decides. */
export interface ActionSettingsPopoverProps extends Omit<BarActionButtonProps, 'onPress' | 'expanded'> {
  form: ActionSettingsForm;
}

/**
 * An action carrying settings, as a bar's or a panel's button: pressing it
 * opens the form in a popover under it rather than triggering the action, and
 * each change in the form triggers it. Disabled as the action is, so a form
 * with nothing to edit never opens.
 */
export function ActionSettingsPopover({ form, ...button }: ActionSettingsPopoverProps) {
  const trigger = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const { anchor, provide, ready } = useOverlayPortal();
  const shown = open && !button.disabled && button.missing === undefined;
  return (
    <>
      <span ref={trigger} className={s.trigger}>
        {anchor}
        <BarActionButton {...button} expanded={shown} onPress={() => setOpen((was) => !was)} />
      </span>
      {ready && provide(
        <RACPopover
          triggerRef={trigger}
          isOpen={shown}
          onOpenChange={setOpen}
          placement="bottom start"
          className={bar.popover}
          data-weasel-overlay=""
        >
          <RACDialog className={`${listbox.surface} ${bar.popBody} ${s.body}`} aria-label={form.schema.name || button.label}>
            {form.schema.name && <p className={s.title}>{form.schema.name}</p>}
            <PrefsForm schema={form.schema} layout="list" values={form.values} mixed={form.mixed} onChange={form.onChange} />
          </RACDialog>
        </RACPopover>,
      )}
    </>
  );
}
