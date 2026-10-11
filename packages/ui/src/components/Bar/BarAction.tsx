import type { ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import type { PrefAction } from '@weasel-js/prefs';
import { useLeafAction } from '../Prefs/useLeafAction';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './Bar.module.css';

/** Props for {@link BarActionButton}. */
export interface BarActionButtonProps {
  label: string;
  icon?: ReactNode;
  /** The keys that fire the action, read after the label in the tooltip. */
  shortcut?: string;
  /** Read the label beside the icon. A button with no icon reads it regardless. */
  labeled?: boolean;
  /** It cannot be pressed now. */
  disabled?: boolean;
  /** Held down. Leave unset for an action with no pressed state. */
  active?: boolean;
  /** Nothing answers to this key. The button is dead, and its tooltip says why. */
  missing?: string;
  onPress: () => void;
  'data-testid'?: string;
}

/**
 * A bar's button for one action: its icon, with the label and shortcut in a
 * tooltip. What `BarAction` draws for a leaf and `ActionBar` for a registry
 * entry.
 */
export function BarActionButton(props: BarActionButtonProps) {
  const { label, icon, shortcut, labeled = false, disabled = false, active, missing, onPress } = props;
  const dead = missing !== undefined;
  const tip = dead ? `${label}: no action “${missing}”` : shortcut ? `${label} (${shortcut})` : label;
  const words = labeled || icon == null;
  return (
    // A dead button keeps its tooltip, which is the only thing that says why it is dead.
    <TooltipTrigger isDisabled={disabled && !dead}>
      <Focusable isDisabled={disabled && !dead}>
        <button
          type="button"
          data-testid={props['data-testid']}
          aria-label={label}
          aria-disabled={disabled || dead || undefined}
          aria-pressed={active}
          disabled={disabled && !dead}
          className={words ? `${s.action} ${s.actionLabeled}` : s.action}
          {...(dead ? { 'data-missing': missing } : {})}
          onClick={() => {
            if (!disabled && !dead) onPress();
          }}
        >
          {icon}
          {words && <span>{label}</span>}
        </button>
      </Focusable>
      <Tooltip>{tip}</Tooltip>
    </TooltipTrigger>
  );
}

/** An `action` leaf as a bar's cell: an icon button, or icon and label for `control: 'button'`. */
export function BarAction({ leaf, path, disabled }: { leaf: PrefAction; path: string; disabled?: boolean }) {
  const { press, ...button } = useLeafAction(leaf, path, disabled);
  return <BarActionButton {...button} labeled={leaf.control === 'button'} onPress={press} />;
}
