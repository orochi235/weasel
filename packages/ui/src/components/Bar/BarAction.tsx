import { useContext, useEffect, useRef, type ReactNode } from 'react';
import { Focusable } from '../Tooltip/Focusable';
import type { PrefAction } from '@weasel-js/prefs';
import { actionLeafVariants, useRegisteredActions } from '../Prefs/registeredActions';
import { useLeafAction } from '../Prefs/useLeafAction';
import { ActionSettingsPopover } from '../ActionSettings/ActionSettingsPopover';
import { segmentTooltipContent } from '../segmentTooltip';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { BarInMenuContext } from './barInMenu';
import s from './Bar.module.css';

/** Props for {@link BarActionButton}. */
export interface BarActionButtonProps {
  label: string;
  /** What the tooltip reads in place of the label. */
  description?: string;
  icon?: ReactNode;
  /** The keys that fire the action, read after the label or description in the tooltip. */
  shortcut?: string;
  /** Read the label beside the icon. A button with no icon reads it regardless. */
  labeled?: boolean;
  /** Drawn as a panel's row: icon and label across the row's width. Implies `labeled`. */
  row?: boolean;
  /** Drawn as a menu's row: icon, label, and shortcut across the row's width. Implies `labeled`. */
  menu?: boolean;
  /** It cannot be pressed now. */
  disabled?: boolean;
  /** Why it cannot be pressed. Given, a disabled button keeps its tooltip and
   *  stays focusable, so the reason can be read. */
  disabledReason?: string;
  /** Held down. Leave unset for an action with no pressed state. */
  active?: boolean;
  /** It opens a dialog, which is open now. Leave unset for a button that opens nothing. */
  expanded?: boolean;
  /** Nothing answers to this key. The button is dead, and its tooltip says why. */
  missing?: string;
  onPress: () => void;
  /** Show what pressing would do, while the button is hovered or focused;
   *  returns what takes it down. */
  preview?: () => () => void;
  'data-testid'?: string;
}

/**
 * A bar's button for one action: its icon, with the label (or description)
 * and shortcut in a tooltip. What `BarAction` draws for a leaf and `ActionBar` for a registry
 * entry.
 */
export function BarActionButton(props: BarActionButtonProps) {
  const { label, description, icon, shortcut, row = false, menu = false, disabled = false, active, expanded, missing, onPress, disabledReason, preview } = props;
  const labeled = row || menu || props.labeled === true;
  const dead = missing !== undefined;
  const { show, hide } = usePreviewWhileNear(disabled || dead ? undefined : preview);
  const explained = dead || (disabled && disabledReason !== undefined);
  const tip = dead
    ? `${label}: no action “${missing}”`
    : disabled && disabledReason !== undefined ? `${label}: ${disabledReason}`
    : segmentTooltipContent({ description: description || label, shortcut });
  const words = labeled || icon == null;
  return (
    // A dead or explained button keeps its tooltip, which is the only thing that says why.
    <TooltipTrigger isDisabled={disabled && !explained}>
      <Focusable isDisabled={disabled && !explained}>
        <button
          type="button"
          data-testid={props['data-testid']}
          aria-label={label}
          aria-disabled={disabled || dead || undefined}
          {...(disabled && disabledReason !== undefined ? { 'aria-description': disabledReason } : {})}
          aria-pressed={active}
          {...(expanded !== undefined ? { 'aria-haspopup': 'dialog' as const, 'aria-expanded': expanded } : {})}
          disabled={disabled && !explained}
          className={[s.action, words && s.actionLabeled, row && s.actionRow, menu && s.actionMenu].filter(Boolean).join(' ')}
          {...(dead ? { 'data-missing': missing } : {})}
          onClick={() => {
            hide();
            if (!disabled && !dead) onPress();
          }}
          onPointerEnter={show}
          onPointerLeave={hide}
          onFocus={show}
          onBlur={hide}
        >
          {icon}
          {words && <span>{label}</span>}
          {menu && shortcut && <span className={s.actionShortcut}>{shortcut}</span>}
        </button>
      </Focusable>
      <Tooltip>{tip}</Tooltip>
    </TooltipTrigger>
  );
}

/** `preview` shown from `show` until `hide`, at most once at a time, and taken
 *  down when the button unmounts or stops offering one. */
function usePreviewWhileNear(preview: (() => () => void) | undefined): { show: () => void; hide: () => void } {
  const stop = useRef<(() => void) | null>(null);
  const hide = () => {
    stop.current?.();
    stop.current = null;
  };
  const show = () => {
    if (preview && !stop.current) stop.current = preview();
  };
  // Keyed on whether there is one, not its identity: a caller builds it each render.
  const offered = preview !== undefined;
  useEffect(() => () => {
    stop.current?.();
    stop.current = null;
  }, [offered]);
  return { show, hide };
}

/** An `action` leaf as a bar's cell: an icon button, or icon and label for `control: 'button'`. A leaf naming a
 *  parametric action by its bare id is a button per variant. */
export function BarAction({ leaf, path, disabled }: { leaf: PrefAction; path: string; disabled?: boolean }) {
  const variants = actionLeafVariants(leaf, useRegisteredActions());
  if (!variants) return <BarActionOne leaf={leaf} path={path} disabled={disabled} />;
  return (
    <span className={s.actions}>
      {variants.map((one, i) => <BarActionOne key={one.action} leaf={one} path={`${path}.${i}`} disabled={disabled} />)}
    </span>
  );
}

function BarActionOne({ leaf, path, disabled }: { leaf: PrefAction; path: string; disabled?: boolean }) {
  const { press, settings, ...button } = useLeafAction(leaf, path, disabled);
  const menu = useContext(BarInMenuContext);
  if (settings) return <ActionSettingsPopover {...button} form={settings} description={leaf.description} labeled={leaf.control === 'button'} menu={menu} />;
  return <BarActionButton {...button} description={leaf.description} labeled={leaf.control === 'button'} menu={menu} onPress={press} />;
}
