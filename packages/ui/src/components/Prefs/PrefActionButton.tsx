import type { PrefAction, PrefActions } from '@weasel-js/prefs';
import { BarActionButton } from '../Bar/BarAction';
import { actionLeafVariants, actionsLeafActions, useRegisteredActions } from './registeredActions';
import { useLeafAction } from './useLeafAction';
import { ActionSettingsPopover } from '../ActionSettings/ActionSettingsPopover';
import s from './Prefs.module.css';

/**
 * An `action` leaf's button in a panel: a row reading its icon and label once,
 * or its icon alone for `control: 'icon'`. A key nothing registered answers to,
 * or an action that says why it cannot run, keeps a tooltip saying so. A leaf
 * naming a parametric action by its bare id is a row per variant.
 */
export function PrefActionButton({ pref, path, disabled }: { pref: PrefAction; path: string; disabled?: boolean }) {
  const variants = actionLeafVariants(pref, useRegisteredActions());
  if (!variants) return <PrefActionOne pref={pref} path={path} disabled={disabled} />;
  return (
    <span className={s.actionRows}>
      {variants.map((one, i) => <PrefActionOne key={one.action} pref={one} path={`${path}.${i}`} disabled={disabled} />)}
    </span>
  );
}

function PrefActionOne({ pref, path, disabled: off }: { pref: PrefAction; path: string; disabled?: boolean }) {
  const { press, settings, ...button } = useLeafAction(pref, path, off);
  const iconOnly = pref.control === 'icon' && button.icon != null;
  if (settings) return <ActionSettingsPopover {...button} form={settings} description={pref.description} row={!iconOnly} />;
  return <BarActionButton {...button} description={pref.description} row={!iconOnly} onPress={press} />;
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
