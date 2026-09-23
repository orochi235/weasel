import { useSyncExternalStore, type ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import {
  useActionsRegistry,
  useOptionalDepRegistry,
  evaluateEnabled,
  buildDepsFromRequires,
  actionItems,
  actionShortcuts,
  type Action,
  type ActionItem,
} from '@weasel-js/core';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import { formatShortcut } from '../ToolPalette/formatShortcut';
import s from './ActionBar.module.css';

const EMPTY_LIST: readonly Action[] = Object.freeze([]);
const noopSubscribe = (): (() => void) => () => {};

/** Props for {@link ActionBar}. */
export interface ActionBarProps {
  /** Group key — only actions with `action.group === group` are rendered. */
  group: string;
  /** Layout direction. Defaults to `'horizontal'`. */
  orientation?: 'horizontal' | 'vertical';
  /**
   * Per-entry icon overrides, keyed by `ActionItem.key` — the action id, or
   * `id:variant` for one variant of a parametric action. When an entry is provided
   * it replaces the action's own `icon` for this bar only. Mirrors
   * `PathfinderPanelProps.icons` so call sites that ship custom glyph sets
   * can swap them in without re-registering actions.
   */
  icons?: Record<string, ReactNode>;
  /**
   * Per-entry label overrides, keyed like `icons`. Drives both `aria-label`
   * and `title`. When omitted, the entry's own `label` is used.
   */
  labels?: Record<string, string>;
  /** Additional class for the toolbar root. */
  className?: string;
}

function resolveIcon(item: ActionItem, override: ReactNode | undefined): ReactNode {
  if (override !== undefined) return override;
  const i = item.icon;
  if (typeof i === 'function') return i();
  return i;
}

function resolveTitle(label: string, item: ActionItem): string {
  const shortcut = item.action.shortcut ?? formatShortcut(actionShortcuts(item.action, item.params)[0]);
  return shortcut ? `${label} (${shortcut})` : label;
}

/**
 * Generic group-keyed action toolbar. Reads the parent `ActionsRegistry`,
 * filters to actions whose `group` matches `props.group`, and renders one
 * icon button per match — or per variant, for an action that declares
 * `variants`. Disabled state is derived from each action's
 * `enabled` predicate via `evaluateEnabled` (so the button greys out and
 * swallows clicks while the keybinding — if any — still fires through the
 * registry's keydown listener; that's the registry's contract, not ours).
 *
 * Visual parity with the WeaselDraw `<PathfinderPanel>` is intentional;
 * this is the generic, registry-driven version. No keyboard navigation
 * (roving tabindex) yet — bar consumers today are short flat strips. Add
 * if/when a long bar lands.
 */
export function ActionBar(props: ActionBarProps) {
  const { group, orientation = 'horizontal', icons, labels, className } = props;
  const registry = useActionsRegistry();
  const depReg = useOptionalDepRegistry();
  const all = useSyncExternalStore(
    registry ? registry.subscribe : noopSubscribe,
    registry ? registry.list : () => EMPTY_LIST,
    registry ? registry.list : () => EMPTY_LIST,
  );
  const items = all.filter((a) => a.group === group).flatMap(actionItems);

  const cls = [s.bar, orientation === 'vertical' && s.vertical, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="toolbar" aria-label={`${group} actions`}>
      {items.map((item) => {
        const label = labels?.[item.key] ?? item.label;
        const icon = resolveIcon(item, icons?.[item.key]);
        // Read at render: `enabled` reflects whatever the deps hold now, so
        // the bar is current as long as its parent re-renders on changes.
        const deps = depReg ? buildDepsFromRequires(item.action, depReg) : undefined;
        const { enabled } = evaluateEnabled(item.action, deps);
        const disabled = !enabled;
        const title = resolveTitle(label, item);
        return (
          <TooltipTrigger key={item.key} isDisabled={disabled}>
            <Focusable isDisabled={disabled}>
              <button
                type="button"
                data-testid={`action-bar-item-${item.key}`}
                aria-label={label}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                className={s.button}
                onClick={() => {
                  if (disabled) return;
                  // Dispatch through the registry so the enabled() guard runs.
                  // If no registry is in scope the click is a no-op — ActionBar
                  // is expected to render under an `ActionsProvider`.
                  registry?.trigger(item.action.id, item.params);
                }}
              >
                {icon}
              </button>
            </Focusable>
            <Tooltip>{title}</Tooltip>
          </TooltipTrigger>
        );
      })}
    </div>
  );
}
