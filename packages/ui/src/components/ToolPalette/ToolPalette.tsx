import { Fragment, type ReactNode } from 'react';
import { toolSetHas, type Tool, type ToolSet, type ToolsApi } from '@weasel-js/core';
import { eligibleContribution, type ModeRegistry } from '@weasel-js/modes';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import s from './ToolPalette.module.css';
import { formatShortcut, type ShortcutInput } from '@weasel-js/gestures';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import { slotsOf, stackIndex, type PaletteSlot } from './stacks';
import { ToolStack, type StackCycleModifier, type StackMember } from './ToolStack';

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
  lookupShortcut?: (toolId: string) => ShortcutInput | undefined;
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
  /** Which of the registered tools this palette shows: a tool set, or a test of
   *  each tool; all of them when omitted. Two palettes over one `tools` with
   *  complementary filters split a canvas's tools between two toolbars. */
  include?: ToolSet | ((tool: Tool) => boolean);
  /** The toolbar's accessible name. Default `"Tools"`. */
  ariaLabel?: string;
  /**
   * Tools that share one button, each stack a list of tool ids in menu order. The button shows
   * the stack's tool in use, or the one last used from it; a click opens a menu of the stack, and
   * a click with `stackCycle` held makes the next one active instead. The stack sits where the
   * first of its tools the palette shows would. Tools named in no stack get buttons of their own.
   */
  stacks?: ReadonlyArray<readonly string[]>;
  /** The modifier that makes a click on a stack step through it. Default `'alt'`. */
  stackCycle?: StackCycleModifier;
}

const slotTools = (slot: PaletteSlot): Tool[] => (slot.kind === 'tool' ? [slot.tool] : slot.members);

/**
 * Toolbar of the registered tools, split into separator-divided groups by
 * each tool's presentation group and navigable by arrow keys. Clicking a
 * button makes that tool active. A tool whose presentation sets `hide`, or
 * that `include` turns down, is left out. Tools listed together in `stacks`
 * share one button, which opens a menu of them.
 *
 * Given a `modeRegistry`, tools whose capabilities the current mode does not
 * allow render greyed out and inert rather than disappearing.
 */
export function ToolPalette(props: ToolPaletteProps) {
  const {
    tools, orientation = 'vertical', className, lookupShortcut, modeRegistry,
    groupOrder = DEFAULT_GROUP_ORDER, include, ariaLabel = 'Tools', stacks = [], stackCycle = 'alt',
  } = props;
  const shows = include === undefined ? () => true
    : typeof include === 'function' ? include : (t: Tool) => toolSetHas(include, t.id);
  const list = Object.values(tools.registry).filter((t) => !t.presentation?.hide && shows(t));
  const groups = partitionByGroup(list);
  const groupKeys = orderedGroupKeys(groups, groupOrder);
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  const shown = new Map(list.map((t) => [t.id, t]));
  const stackOf = stackIndex(stacks);
  const placed = new Set<readonly string[]>();
  const slotGroups = groupKeys.map((key) => ({ key, slots: slotsOf(groups.get(key)!, shown, stackOf, placed) }));
  const modeName = modeRegistry ? modeRegistry.current().id : undefined;
  const describe = (tool: Tool): StackMember => {
    const label = tool.presentation?.label ?? tool.id;
    const keys = lookupShortcut ? lookupShortcut(tool.id) : tool.keybinding;
    return {
      tool, label, keys,
      shortcut: tool.presentation?.shortcut ?? formatShortcut(keys),
      enabled: modeRegistry ? eligibleContribution(modeRegistry, tool) : true,
    };
  };

  // Flat, in DOM order — the roving-tabindex hook indexes by this order.
  const ordered = slotGroups.flatMap((g) => g.slots);
  const activeIndex = ordered.findIndex((slot) => slotTools(slot).some((t) => t.id === tools.active));
  const roving = useRovingTabIndex({
    itemSelector: `.${s.paletteBtn}`,
    tabStopIndex: activeIndex >= 0 ? activeIndex : undefined,
  });

  return (
    <div
      ref={roving.rootRef}
      onKeyDown={roving.onKeyDown}
      className={cls}
      role="toolbar"
      aria-label={ariaLabel}
    >
      {slotGroups.map(({ key, slots }, i) => (
        <Fragment key={key}>
          {i > 0 && (
            <div
              className={s.separator}
              role="separator"
              aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
            />
          )}
          <ToolGroup orientation={orientation} groupKey={key}>
            {slots.map((slot) => {
              if (slot.kind === 'stack') {
                return (
                  <ToolStack
                    key={slot.members[0].id}
                    members={slot.members.map(describe)}
                    active={tools.active}
                    setActive={(id) => tools.setActive(id)}
                    cycle={stackCycle}
                  />
                );
              }
              const { tool, label, shortcut, enabled } = describe(slot.tool);
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
