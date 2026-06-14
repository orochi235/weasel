import { Fragment, useRef, type ReactNode } from 'react';
import { UnknownIcon } from '@orochi235/weasel';
import type { AnyTool, ToolsApi } from '@orochi235/weasel';
import { eligibleTool, type ModeRegistry } from '@orochi235/weasel-modes';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import s from './ToolPalette.module.css';
import { formatShortcut, type ShortcutInput } from './formatShortcut';

const DEFAULT_GROUP_ORDER = ['select', 'shape', 'draw', 'type', 'view'] as const;
const MISC = 'misc';

function partitionByGroup(list: AnyTool[]): Map<string, AnyTool[]> {
  const groups = new Map<string, AnyTool[]>();
  for (const tool of list) {
    const g = tool.presentation?.group ?? MISC;
    const bucket = groups.get(g) ?? [];
    bucket.push(tool);
    groups.set(g, bucket);
  }
  return groups;
}

function orderedGroupKeys(groups: Map<string, AnyTool[]>): string[] {
  const seen = new Set(groups.keys());
  const ordered: string[] = [];
  for (const known of DEFAULT_GROUP_ORDER) {
    if (seen.has(known)) {
      ordered.push(known);
      seen.delete(known);
    }
  }
  // Unknown groups in insertion order (Map preserves it), misc last.
  for (const key of groups.keys()) {
    if (seen.has(key) && key !== MISC) {
      ordered.push(key);
      seen.delete(key);
    }
  }
  if (seen.has(MISC)) ordered.push(MISC);
  return ordered;
}

function resolveIcon(tool: AnyTool): ReactNode {
  const rawIcon = tool.presentation?.icon;
  if (rawIcon == null) return <UnknownIcon />;
  if (typeof rawIcon === 'function') return rawIcon(undefined);
  return rawIcon;
}

export interface ToolPaletteProps {
  tools: ToolsApi;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  /** Derive the keyboard shortcut for a tool button from the action registry.
   *  Called with the tool's id; return `undefined` to suppress a chip. When
   *  omitted, falls back to `tool.keybinding` (legacy path). */
  lookupShortcut?: (toolId: string) => ShortcutInput | undefined;
  /**
   * Optional mode registry. When provided, tools whose `capabilities` do not
   * match the current mode are rendered greyed-out, aria-disabled, and their
   * onClick is suppressed. When omitted, all tools are treated as eligible
   * (preserves existing behaviour in consumers that haven't wired a registry).
   */
  modeRegistry?: ModeRegistry;
}

export function ToolPalette(props: ToolPaletteProps) {
  const { tools, orientation = 'vertical', className, lookupShortcut, modeRegistry } = props;
  const list = Object.values(tools.registry);
  const groups = partitionByGroup(list);
  const groupKeys = orderedGroupKeys(groups);
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  const orderedIds = groupKeys.flatMap((k) => groups.get(k)!.map((t) => t.id));
  const tabbableId = tools.active && orderedIds.includes(tools.active)
    ? tools.active
    : orderedIds[0];
  const rootRef = useRef<HTMLDivElement | null>(null);

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'BUTTON') return;
    const root = rootRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
    const i = buttons.indexOf(target as HTMLButtonElement);
    if (i < 0) return;

    let next = -1;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = (i + 1) % buttons.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = (i - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = buttons.length - 1;
        break;
    }
    if (next >= 0) {
      e.preventDefault();
      buttons[next].focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className={cls}
      role="toolbar"
      aria-label="Tools"
      onKeyDown={onKeyDown}
    >
      {groupKeys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && (
            <div
              className={s.separator}
              role="separator"
              aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
            />
          )}
          <ToolGroup orientation={orientation} groupKey={key}>
            {groups.get(key)!.map((tool) => {
              const label = tool.presentation?.label ?? tool.id;
              const shortcut = tool.presentation?.shortcut
                ?? formatShortcut(lookupShortcut ? lookupShortcut(tool.id) : tool.keybinding);
              const enabled = modeRegistry ? eligibleTool(modeRegistry, tool) : true;
              const modeName = modeRegistry ? modeRegistry.current().id : undefined;
              const resolvedTitle = !enabled && modeName
                ? `${label}${shortcut ? ` (${shortcut})` : ''} — disabled in ${modeName} mode`
                : undefined;
              return (
                <ToolButton
                  key={tool.id}
                  icon={resolveIcon(tool)}
                  label={label}
                  shortcut={shortcut}
                  active={tools.active === tool.id}
                  tabbable={tool.id === tabbableId}
                  ariaDisabled={!enabled}
                  className={!enabled ? s.ineligibleBtn : undefined}
                  title={resolvedTitle}
                  onClick={enabled ? () => tools.setActive(tool.id) : () => {}}
                />
              );
            })}
          </ToolGroup>
        </Fragment>
      ))}
    </div>
  );
}
