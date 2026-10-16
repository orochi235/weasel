import type { PrefActions } from '@weasel-js/prefs';
import { actionsLeafActions, useRegisteredActions, type ActionsLeafOptions } from '../Prefs/registeredActions';
import { BarAction } from './BarAction';
import s from './Bar.module.css';

/** Props for {@link BarActions}. */
export interface BarActionsProps extends ActionsLeafOptions {
  leaf: PrefActions;
  path: string;
  disabled?: boolean;
}

/**
 * An `actions` leaf as a bar's cell: one button per entry of its registry
 * group, each the button an `action` leaf naming it draws. An action
 * registered later joins the run without the schema changing.
 */
export function BarActions({ leaf, path, disabled, ...options }: BarActionsProps) {
  const leaves = actionsLeafActions(leaf, useRegisteredActions(), options);
  if (leaves.length === 0) return null;
  return (
    <span className={s.actions}>
      {leaves.map((one, i) => (
        <BarAction key={one.action} leaf={one} path={`${path}.${i}`} disabled={disabled} />
      ))}
    </span>
  );
}
