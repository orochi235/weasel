import type { PrefAction } from '@weasel-js/prefs';
import { actionLeafVariants, useRegisteredActions } from './registeredActions';
import { useLeafAction } from './useLeafAction';
import { ActionSettingsPopover } from '../ActionSettings/ActionSettingsPopover';
import { ActionButton } from '../ActionButton/ActionButton';
import { drawsBarForm, useControlForm, type ControlForm } from '../ActionButton/controlForm';
import bar from '../Bar/Bar.module.css';
import prefs from './Prefs.module.css';

/** Props for {@link ActionLeaf}. */
export interface ActionLeafProps {
  leaf: PrefAction;
  path: string;
  disabled?: boolean;
  active?: boolean;
  /** Where it is drawn. Default: the nearest `FormScope`'s. */
  form?: ControlForm;
}

/**
 * An `action` leaf's button, in the form of where it sits. In a bar's cell it is an icon button, or icon and label
 * for `control: 'button'`; in a row, icon and label once, or the icon alone for `control: 'icon'`. A key nothing
 * registered answers to, or an action that says why it cannot run, keeps a tooltip saying so. A leaf naming a
 * parametric action by its bare id is a button per variant.
 */
export function ActionLeaf(props: ActionLeafProps) {
  const { leaf, path, disabled, active } = props;
  const form = useControlForm(props.form);
  const variants = actionLeafVariants(leaf, useRegisteredActions());
  if (!variants) return <ActionLeafButton leaf={leaf} path={path} disabled={disabled} active={active} form={form} />;
  return (
    <span className={drawsBarForm(form) ? bar.actions : prefs.actionRows}>
      {variants.map((one, i) => <ActionLeafButton key={one.action} leaf={one} path={`${path}.${i}`} disabled={disabled} active={active} form={form} />)}
    </span>
  );
}

function ActionLeafButton({ leaf, path, disabled, active, form }: ActionLeafProps & { form: ControlForm }) {
  const { press, settings, ...button } = useLeafAction(leaf, path, disabled, active);
  const labeled = drawsBarForm(form) ? leaf.control === 'button' : !(leaf.control === 'icon' && button.icon != null);
  if (settings) return <ActionSettingsPopover {...button} form={form} settings={settings} labeled={labeled} />;
  return <ActionButton {...button} form={form} labeled={labeled} onPress={press} />;
}
