import type { MouseEvent, ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './PropertyHelp.module.css';
import row from './Properties.module.css';

/** Props for `<PropertyHelp>`. */
export interface PropertyHelpProps {
  /** What the help is about; a string names the button `About <label>`. */
  label: ReactNode;
  description?: string;
  /** What the setting reads when it is auto; the tooltip's last line, after the word
   *  `auto` drawn as an auto row's readout draws it. */
  autoValue?: ReactNode;
  /** Whether the tooltip is open, for an owner that also opens it itself. Unset, hover and focus alone do. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Something else carries the help to a keyboard and a screen reader (a `<PropertyRow>` gives it to its
   *  control), so the ⓘ is the pointer's alone: out of the tab order and hidden from assistive tech. */
  carried?: boolean;
}

/** The ⓘ beside a row label that shows its `description` in a tooltip. Exported
 *  for surfaces that draw a params label outside a `<PropertyRow>`. A tooltip
 *  trigger has to be interactive to be keyboard-reachable, so this is a real
 *  button, and a tab stop unless the help is `carried` another way. */
export function PropertyHelp({ label, description, autoValue, open, onOpenChange, carried = false }: PropertyHelpProps) {
  const name = typeof label === 'string' ? label : 'this setting';
  const stop = (e: MouseEvent): void => {
    // The wrapping <label> would otherwise actuate the row's control.
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <TooltipTrigger isOpen={open} onOpenChange={onOpenChange}>
      <Focusable excludeFromTabOrder={carried}>
        {carried ? (
          // Not a <button>: that is a labelable element, and as the first one in the row's <label> it would be
          // the control the label names, in place of the row's own.
          <span role="img" aria-hidden className={s.help} onClick={stop} onMouseDown={(e) => e.stopPropagation()}>
            ⓘ
          </span>
        ) : (
          <button
            type="button"
            className={s.help}
            aria-label={`About ${name}`}
            onClick={stop}
            onMouseDown={(e) => e.stopPropagation()}
          >
            ⓘ
          </button>
        )}
      </Focusable>
      <Tooltip>
        {description}
        {autoValue != null && (
          <span className={description ? `${s.auto} ${s.autoAfter}` : s.auto}>
            <em className={row.autoWord}>auto</em> {autoValue}
          </span>
        )}
      </Tooltip>
    </TooltipTrigger>
  );
}
