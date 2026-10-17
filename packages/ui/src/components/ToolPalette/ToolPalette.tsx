import { Fragment, type ReactNode } from 'react';
import type { Tool, ToolsApi } from '@weasel-js/core';
import type { MenuShortcut } from '@weasel-js/menu';
import { eligibleContribution, type ModeRegistry } from '@weasel-js/modes';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import s from './ToolPalette.module.css';
import { formatShortcut } from './formatShortcut';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';

const DEFAULT_GROUP_ORDER = ['select', 'shape', 'draw', 'type', 'view'] as const;
const MISC = 'misc';

function partitionByGroup(list: Tool[]): Map<string, Tool[]> {
  const groups = new Map<string, Tool[]>();
  for (const tool of list) {
    const g = tool.presentation?.group ?? MISC;
    const bucket = groups.get(g) ?? [];
    bucket.push(tool);
    groups.set(g, bucket);
  }
  return groups;
}

function orderedGroupKeys(
  groups: Map<string, Tool[]>,
  groupOrder: readonly string[],
): string[] {
  const seen = new Set(groups.keys());
  const ordered: string[] = [];
  for (const known of groupOrder) {
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

function toolGlyph(tool: Tool): ReactNode {
  return <Icon name={tool.presentation?.icon ?? icon('core:unknown')} />;
}

/** Props for {@link ToolPalette}. */
export interface ToolPaletteProps {
  tools: ToolsApi;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  /** Derive the keyboard shortcut for a tool button from the action registry.
   *  Called with the tool's id; return `undefined` to suppress a chip. When
   *  omitted, falls back to `tool.keybinding` (legacy path). */
  lookupShortcut?: (toolId: string) => MenuShortcut | undefined;
  /**
   * Optional mode registry. When provided, tools whose
   * `eligibility.capabilities` do not match the current mode are rendered
   * greyed-out, aria-disabled, and their onClick is suppressed. When omitted,
   * all tools are treated as eligible (preserves existing behavior in
   * consumers that haven't wired a registry).
   */
  modeRegistry?: ModeRegistry;
  /**
   * Presentation-group display order. Groups not listed keep their registry
   * insertion order after the listed ones; `misc` always renders last.
   * Defaults to `['select', 'shape', 'draw', 'type', 'view']`.
   */
  groupOrder?: readonly string[];
  /** Which of the registered tools this palette shows; all of them when omitted.
   *  Two palettes over one `tools` with complementary filters split a canvas's
   *  tools between two toolbars. */
  include?: (tool: Tool) => boolean;
  /** The toolbar's accessible name. Default `"Tools"`. */
  ariaLabel?: string;
}

/**
 * Toolbar of the registered tools, split into separator-divided groups by
 * each tool's presentation group and navigable by arrow keys. Clicking a
 * button makes that tool active. A tool whose presentation sets `hide`, or
 * that `include` turns down, is left out.
 *
 * Given a `modeRegistry`, tools whose capabilities the current mode does not
 * allow render greyed out and inert rather than disappearing.
 */
export function ToolPalette(props: ToolPaletteProps) {
  const {
    tools, orientation = 'vertical', className, lookupShortcut, modeRegistry,
    groupOrder = DEFAULT_GROUP_ORDER, include, ariaLabel = 'Tools',
  } = props;
  const list = Object.values(tools.registry).filter((t) => !t.presentation?.hide && (!include || include(t)));
  const groups = partitionByGroup(list);
  const groupKeys = orderedGroupKeys(groups, groupOrder);
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  // Flat, in DOM order — the roving-tabindex hook indexes by this order.
  const ordered = groupKeys.flatMap((k) => groups.get(k)!);
  const eligibility = ordered.map(
    (tool) => (modeRegistry ? eligibleContribution(modeRegistry, tool) : true),
  );
  const activeIndex = ordered.findIndex((t) => t.id === tools.active);
  const roving = useRovingTabIndex({
    itemSelector: `.${s.paletteBtn}`,
    tabStopIndex: activeIndex >= 0 ? activeIndex : undefined,
  });
  let index = -1;

  return (
    <div
      ref={roving.rootRef}
      onKeyDown={roving.onKeyDown}
      className={cls}
      role="toolbar"
      aria-label={ariaLabel}
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
              const i = ++index;
              const label = tool.presentation?.label ?? tool.id;
              const shortcut = tool.presentation?.shortcut
                ?? formatShortcut(lookupShortcut ? lookupShortcut(tool.id) : tool.keybinding);
              const enabled = eligibility[i];
              const modeName = modeRegistry ? modeRegistry.current().id : undefined;
              const resolvedTitle = !enabled && modeName
                ? `${label}${shortcut ? ` (${shortcut})` : ''} — disabled in ${modeName} mode`
                : undefined;
              return (
                <ToolButton
                  key={tool.id}
                  icon={toolGlyph(tool)}
                  label={label}
                  shortcut={shortcut}
                  active={tools.active === tool.id}
                  ariaDisabled={!enabled}
                  className={[s.paletteBtn, !enabled && s.ineligibleBtn].filter(Boolean).join(' ')}
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
