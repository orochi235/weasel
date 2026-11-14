import type { PrefActions } from '@weasel-js/prefs';
import { actionsLeafActions, useRegisteredActions, type ActionsLeafOptions } from './registeredActions';
import { drawsBarForm, useControlForm, type ControlForm } from '../ActionButton/controlForm';
import { ActionLeaf } from './ActionLeaf';
import { BAR_IN, BAR_UNIT, useBarMarks } from '../Bar/barOrder';
import s from '../Bar/Bar.module.css';
import prefs from './Prefs.module.css';

/** Props for {@link ActionsLeaf}. */
export interface ActionsLeafProps extends ActionsLeafOptions {
  leaf: PrefActions;
  path: string;
  disabled?: boolean;
  /** Where it is drawn. Default: the nearest `FormScope`'s. */
  form?: ControlForm;
}

/**
 * An `actions` leaf: one button per entry of its registry group, each the button an `action` leaf naming it draws,
 * in a bar's cell or one row under another. An action registered later joins the run without the schema changing.
 */
export function ActionsLeaf({ leaf, path, disabled, form: own, ...options }: ActionsLeafProps) {
  const form = useControlForm(own);
  const leaves = actionsLeafActions(leaf, useRegisteredActions(), options);
  const marked = useBarMarks();
  if (leaves.length === 0) return null;
  return (
    <span className={drawsBarForm(form) ? s.actions : prefs.actionRows}>
      {leaves.map((one, i) => {
        const button = <ActionLeaf key={one.action} leaf={one} path={`${path}.${i}`} disabled={disabled} form={form} />;
        if (!marked) return button;
        return (
          <span key={one.action} className={s.unit} {...{ [BAR_IN]: path, [BAR_UNIT]: one.action }}>
            {button}
          </span>
        );
      })}
    </span>
  );
}
