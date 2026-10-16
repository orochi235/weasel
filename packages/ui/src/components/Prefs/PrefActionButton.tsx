import type { PrefAction, PrefActions } from '@weasel-js/prefs';
import { BarActionButton } from '../Bar/BarAction';
import { actionsLeafActions, useRegisteredActions } from './registeredActions';
import { useLeafAction } from './useLeafAction';
import s from './Prefs.module.css';

/**
 * An `action` leaf's button in a panel: a row reading its icon and label once,
 * or its icon alone for `control: 'icon'`. A key nothing registered answers to,
 * or an action that says why it cannot run, keeps a tooltip saying so.
 */
export function PrefActionButton({ pref, path, disabled: off }: { pref: PrefAction; path: string; disabled?: boolean }) {
  const { press, reason, ...button } = useLeafAction(pref, path, off);
  const iconOnly = pref.control === 'icon' && button.icon != null;
  return <BarActionButton {...button} row={!iconOnly} disabledReason={reason} onPress={press} />;
}

/** An `actions` leaf in a panel: one {@link PrefActionButton} row per entry of its registry group. */
export function PrefActionRows({ pref, path, disabled }: { pref: PrefActions; path: string; disabled?: boolean }) {
  const leaves = actionsLeafActions(pref, useRegisteredActions());
  if (leaves.length === 0) return null;
  return (
    <span className={s.actionRows}>
      {leaves.map((one, i) => (
        <PrefActionButton key={one.action} pref={one} path={`${path}.${i}`} disabled={disabled} />
      ))}
    </span>
  );
}
