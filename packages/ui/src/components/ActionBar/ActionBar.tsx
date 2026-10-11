import { useLayoutEffect, useReducer, useSyncExternalStore, type ReactNode } from 'react';
import {
  useActionsRegistry,
  useOptionalDepRegistry,
  evaluateActive,
  evaluateEnabled,
  buildDepsFromRequires,
  actionItems,
  actionShortcuts,
  type Action,
  type ActionItem,
} from '@weasel-js/core';
import { BarActionButton } from '../Bar/BarAction';
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
  const read = (item: ActionItem): { enabled: boolean; active: boolean | undefined } => {
    const deps = depReg ? buildDepsFromRequires(item.action, depReg) : undefined;
    return { enabled: evaluateEnabled(item.action, deps).enabled, active: evaluateActive(item.action, deps) };
  };
  // Dep sources publish on commit, so a render reads the previous commit's
  // deps. Once this one commits, re-render if what they say now differs.
  const shown = items.map(read);
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  useLayoutEffect(() => {
    const stale = items.some((item, i) => {
      const now = read(item);
      return now.enabled !== shown[i]!.enabled || now.active !== shown[i]!.active;
    });
    if (stale) recheck();
  });

  const cls = [s.bar, orientation === 'vertical' && s.vertical, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="toolbar" aria-label={`${group} actions`}>
      {items.map((item, i) => (
        <BarActionButton
          key={item.key}
          data-testid={`action-bar-item-${item.key}`}
          label={labels?.[item.key] ?? item.label}
          icon={resolveIcon(item, icons?.[item.key])}
          shortcut={item.action.shortcut ?? formatShortcut(actionShortcuts(item.action, item.params)[0])}
          disabled={!shown[i]!.enabled}
          active={shown[i]!.active}
          // Through the registry, so the action's own guard runs. With no
          // registry in scope the click does nothing.
          onPress={() => registry?.trigger(item.action.id, item.params)}
        />
      ))}
    </div>
  );
}
