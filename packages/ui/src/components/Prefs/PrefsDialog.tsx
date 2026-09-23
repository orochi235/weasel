import type { ReactNode } from 'react';
import { Dialog } from '../Dialog';
import { PrefsForm, type PrefsFormProps } from './PrefsForm';
import s from './Prefs.module.css';

/**
 * Props for {@link PrefsDialog} — everything {@link PrefsForm} takes, plus
 * the dialog's own open state and chrome.
 */
export interface PrefsDialogProps extends PrefsFormProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog heading. Defaults to the schema root's `name`. */
  title?: ReactNode;
  /** Extra chrome rendered at the end of the title row (e.g. a dev-mode
   *  "Show hidden" switch). An action the reader acts on when they are done
   *  — resetting, importing — belongs in `footer` instead, where a dialog's
   *  actions live. */
  headerExtra?: ReactNode;
  /** Footer slot, passed through to `Dialog` — typically a reset or done
   *  action. */
  footer?: ReactNode;
  /** Class applied to the dialog's modal box. */
  dialogClassName?: string;
}

/**
 * The kit's preferences dialog: `Dialog` + `PrefsForm`. Changes apply
 * live through `onChange` — there is no OK/Cancel staging. For custom
 * placement (sidebar, popover, inline page), compose `PrefsForm`
 * directly; this wrapper is intentionally thin.
 *
 * `layout="rail"` is what a dialog usually wants: the default columns wrap
 * sideways past two groups, and this box is 900px at its widest.
 */
export function PrefsDialog(props: PrefsDialogProps) {
  const { isOpen, onOpenChange, title, headerExtra, footer, dialogClassName, ...form } = props;
  const rail = form.layout === 'rail';
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      aria-label={typeof title === 'string' ? title : form.schema.name}
      className={dialogClassName}
      footer={footer}
      bodyClassName={rail ? s.railBody : undefined}
      title={
        headerExtra !== undefined ? (
          <span className={s.titleRow}>
            <span>{title ?? form.schema.name}</span>
            {headerExtra}
          </span>
        ) : (
          title ?? form.schema.name
        )
      }
    >
      <PrefsForm {...form} />
    </Dialog>
  );
}
