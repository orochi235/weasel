import { useSyncExternalStore, type ReactNode } from 'react';
import {
  useActionsRegistry,
  evaluateEnabled,
  type Action,
} from '@orochi235/weasel';
import s from './ActionBar.module.css';

const EMPTY_LIST: readonly Action[] = Object.freeze([]);
const noopSubscribe = (): (() => void) => () => {};

export interface ActionBarProps {
  /** Group key — only actions with `action.group === group` are rendered. */
  group: string;
  /** Layout direction. Defaults to `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Per-id icon overrides — keyed by `action.id`. When an entry is provided
   * it replaces the action's own `icon` for this bar only. Mirrors
   * `PathfinderPanelProps.icons` so call sites that ship custom glyph sets
   * can swap them in without re-registering actions.
   */
  icons?: Record<string, ReactNode>;
  /**
   * Per-id label overrides — keyed by `action.id`. Drives both `aria-label`
   * and `title`. When omitted, the action's own `label` is used.
   */
  labels?: Record<string, string>;
  /** Additional class for the toolbar root. */
  className?: string;
}

function resolveIcon(action: Action, override: ReactNode | undefined): ReactNode {
  if (override !== undefined) return override;
  const i = action.icon;
  if (typeof i === 'function') return i();
  return i;
}

function resolveTitle(label: string, shortcut: string | undefined): string {
  return shortcut ? `${label} (${shortcut})` : label;
}

/**
 * Generic group-keyed action toolbar. Reads the parent `ActionsRegistry`,
 * filters to actions whose `group` matches `props.group`, and renders one
 * icon button per match. Disabled state is derived from each action's
 * `enabled` predicate via `evaluateEnabled` (so the button greys out and
 * swallows clicks while the keybinding — if any — still fires through the
 * registry's keydown listener; that's the registry's contract, not ours).
 *
 * Visual parity with the swillustrator `<PathfinderPanel>` is intentional;
 * this is the generic, registry-driven version. No keyboard navigation
 * (roving tabindex) yet — bar consumers today are short flat strips. Add
 * if/when a long bar lands.
 */
export function ActionBar(props: ActionBarProps) {
  const { group, orientation = 'horizontal', icons, labels, className } = props;
  const registry = useActionsRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noopSubscribe,
    registry ? registry.list : () => EMPTY_LIST,
    registry ? registry.list : () => EMPTY_LIST,
  );
  const actions = all.filter((a) => a.group === group);

  const cls = [s.bar, orientation === 'vertical' && s.vertical, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="toolbar" aria-label={`${group} actions`}>
      {actions.map((action) => {
        const label = labels?.[action.id] ?? action.label;
        const icon = resolveIcon(action, icons?.[action.id]);
        const { enabled } = evaluateEnabled(action);
        const disabled = !enabled;
        const title = resolveTitle(label, action.shortcut);
        return (
          <button
            key={action.id}
            type="button"
            data-testid={`action-bar-item-${action.id}`}
            aria-label={label}
            aria-disabled={disabled || undefined}
            disabled={disabled}
            title={title}
            className={s.button}
            onClick={() => {
              if (disabled) return;
              action.run();
            }}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
