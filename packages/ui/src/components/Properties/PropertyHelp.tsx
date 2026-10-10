import type { ReactNode } from 'react';
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
}

/** The ⓘ beside a row label that shows its `description` in a tooltip. Exported
 *  for surfaces that draw a params label outside a `<PropertyRow>`. A tooltip
 *  trigger has to be interactive to be keyboard-reachable, so this is a real
 *  button. */
export function PropertyHelp({ label, description, autoValue }: PropertyHelpProps) {
  const name = typeof label === 'string' ? label : 'this setting';
  return (
    <TooltipTrigger>
      <Focusable>
        <button
          type="button"
          className={s.help}
          aria-label={`About ${name}`}
          onClick={(e) => {
            // The wrapping <label> would otherwise actuate the row's control.
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          ⓘ
        </button>
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
