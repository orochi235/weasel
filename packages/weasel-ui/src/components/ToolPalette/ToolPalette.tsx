import { Fragment, type ReactNode } from 'react';
import { UnknownIcon } from '@orochi235/weasel';
import type { AnyTool, ToolsApi } from '@orochi235/weasel';
import s from './ToolPalette.module.css';
import { formatShortcut } from './formatShortcut';

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
}

export function ToolPalette(props: ToolPaletteProps) {
  const { tools, orientation = 'vertical', className } = props;
  const list = Object.values(tools.registry);
  const groups = partitionByGroup(list);
  const groupKeys = orderedGroupKeys(groups);
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  return (
    <div className={cls} role="toolbar" aria-label="Tools">
      {groupKeys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && (
            <div
              className={s.separator}
              role="separator"
              aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
            />
          )}
          <div className={s.group} role="group" data-group={key}>
            {groups.get(key)!.map((tool) => {
              const label = tool.presentation?.label ?? tool.id;
              const icon = resolveIcon(tool);
              const shortcut = tool.presentation?.shortcut ?? formatShortcut(tool.keybinding);
              const title = shortcut ? `${label} (${shortcut})` : label;
              const isActive = tools.active === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  title={title}
                  className={[s.button, isActive && s.active].filter(Boolean).join(' ')}
                  aria-current={isActive ? 'true' : undefined}
                  onClick={() => tools.setActive(tool.id)}
                >
                  <span className={s.icon} aria-hidden="true">{icon}</span>
                  <span className={s.label}>{label}</span>
                  {shortcut && <span className={s.shortcut}>{shortcut}</span>}
                </button>
              );
            })}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
