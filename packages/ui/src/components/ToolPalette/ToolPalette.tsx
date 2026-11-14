import type { DragEvent, ReactNode } from 'react';
import {
  BUILTIN_TOOL_IDS, TOOL_GROUP_ORDER, toolIdsOf, toolSetHas, toolStacksOf, type CarryPayload, type Tool, type ToolSet, type ToolsApi,
} from '@weasel-js/core';
import { eligibleContribution, type ModeRegistry } from '@weasel-js/modes';
import type { Orientation } from '../Run';
import { ToolRail, type StackCycleModifier, type ToolRailButton, type ToolRailItem } from '../ToolRail';
import s from './ToolPalette.module.css';
import type { DisableableProps } from '../Disabled';
import { icon } from '../../icons.gen';
import { groupTools } from './order';
import { slotsOf, stackIndex } from './stacks';
import { useToolCarry } from './useToolCarry';

/** Props for {@link ToolPalette}. */
export interface ToolPaletteProps extends DisableableProps {
  tools: ToolsApi;
  orientation?: Orientation;
  className?: string;
  /**
   * Optional mode registry. When provided, tools whose
   * `eligibility.capabilities` do not match the current mode are shown as
   * `ineligible` says. When omitted, all tools are treated as eligible
   * (preserves existing behavior in consumers that haven't wired a registry).
   */
  modeRegistry?: ModeRegistry;
  /** What a tool the current mode does not allow looks like: `'dim'`, the
   *  default, greys it out, aria-disabled and inert; `'hide'` leaves it out, so
   *  the palette holds only the tools the mode allows. */
  ineligible?: 'dim' | 'hide';
  /**
   * Presentation-group display order. Groups not listed keep their registry
   * insertion order after the listed ones; `misc` always renders last.
   * Defaults to core's `TOOL_GROUP_ORDER`: selection, navigation, then the
   * tools that make things.
   */
  groupOrder?: readonly string[];
  /** Tool display order within each group, by id. Tools not listed keep their
   *  registry insertion order after the listed ones. Defaults to core's
   *  `BUILTIN_TOOL_IDS`. */
  toolOrder?: readonly string[];
  /** Which of the registered tools this palette shows: a tool set, or a test of
   *  each tool; all of them when omitted. Two palettes over one `tools` with
   *  complementary filters split a canvas's tools between two toolbars. */
  include?: ToolSet | ((tool: Tool) => boolean);
  /** The toolbar's accessible name. Default `"Tools"`. */
  'aria-label'?: string;
  /**
   * Tools that share one button, each stack a list of tool ids in menu order. The button shows
   * the stack's tool in use, or the one last used from it; a click opens a menu of the stack, and
   * a click with `stackCycle` held makes the next one active instead. The stack sits where the
   * first of its tools the palette shows would. Tools named in no stack get buttons of their own.
   * A set given here is one stack of every id it names. Defaults to the sets marked `stack` inside
   * an `include` set (`toolStacksOf`); given, it replaces them.
   */
  stacks?: ReadonlyArray<readonly string[] | ToolSet>;
  /** The modifier that makes a click on a stack step through it. Default `'alt'`. */
  stackCycle?: StackCycleModifier;
  /** Lays each group out as a grid this many buttons across, the groups stacked; `orientation`
   *  then says nothing. */
  columns?: number;
  /** Makes each tool's button a drag source, so dragging one out can do what clicking it would
   *  then do on the canvas (drop a node, say). Called as a drag starts; set the drag's data here. */
  onToolDragStart?: (tool: Tool, e: DragEvent<HTMLButtonElement>) => void;
  /** Makes each tool's button the source of an in-app carry (`startCarry`): a press carries what
   *  this returns for the tool over the page, to a canvas whose bindings take its `type`. A press
   *  that moves less than a click's slop still picks the tool; one that moves further carries and
   *  picks nothing. Return `null` to leave a tool's button a plain button. */
  carryTool?: (tool: Tool) => CarryPayload | null;
  /** What follows the pointer, centered on it, while a tool `carryTool` carries is on the move: the
   *  thing it drops, at the size it lands. Unset, nothing follows it. */
  carryGhost?: (tool: Tool) => ReactNode;
}

function paletteStacks(stacks: ToolPaletteProps['stacks'], include: ToolPaletteProps['include']): (readonly string[])[] {
  if (stacks) return stacks.map((stack) => ('members' in stack ? toolIdsOf([stack]) : stack));
  return include !== undefined && typeof include !== 'function' ? toolStacksOf([include]) : [];
}

/**
 * A {@link ToolRail} of the registered tools, split into rule-divided groups by
 * each tool's presentation group and navigable by arrow keys. Clicking a
 * button makes that tool active. Each button's chip and tooltip show the key
 * that activates its tool now (`tools.shortcuts`), so a rebound key shows rebound. A tool whose presentation sets `hide`, or
 * that `include` turns down, is left out. Tools listed together in `stacks`
 * share one button, which opens a menu of them.
 *
 * Given a `modeRegistry`, tools whose capabilities the current mode does not
 * allow render greyed out and inert, or with `ineligible="hide"` not at all.
 */
export function ToolPalette(props: ToolPaletteProps) {
  const {
    tools, orientation = 'vertical', className, modeRegistry, ineligible = 'dim',
    groupOrder = TOOL_GROUP_ORDER, toolOrder = BUILTIN_TOOL_IDS, include, 'aria-label': ariaLabel = 'Tools', stacks, stackCycle = 'alt',
    columns, onToolDragStart, carryTool, carryGhost, disabled, disabledReason: ownReason,
  } = props;
  const carry = useToolCarry(carryTool, carryGhost);
  const shows = include === undefined ? () => true
    : typeof include === 'function' ? include : (t: Tool) => toolSetHas(include, t.id);
  const allowed = (t: Tool): boolean => !modeRegistry || eligibleContribution(modeRegistry, t);
  const list = Object.values(tools.registry)
    .filter((t) => !t.presentation?.hide && shows(t) && (ineligible === 'dim' || allowed(t)));
  const shown = new Map(list.map((t) => [t.id, t]));
  const stackOf = stackIndex(paletteStacks(stacks, include));
  const placed = new Set<readonly string[]>();
  const disabledReason = modeRegistry ? `disabled in ${modeRegistry.current().id} mode` : undefined;

  const button = (tool: Tool, group: string): ToolRailButton => {
    const enabled = allowed(tool);
    return {
      id: tool.id,
      group,
      icon: tool.presentation?.icon ?? icon('core:unknown'),
      label: tool.presentation?.label ?? tool.id,
      description: tool.presentation?.description,
      shortcut: tools.shortcuts[tool.id]?.[0],
      active: tools.active === tool.id,
      ...(enabled ? {} : { disabled: true, disabledReason }),
      onPress: () => { if (!carry.carried()) tools.setActive(tool.id); },
      onPointerDown: carryTool && enabled ? (e) => carry.press(tool, e) : undefined,
      onDragStart: onToolDragStart && enabled ? (e) => onToolDragStart(tool, e) : undefined,
      className: carryTool?.(tool) != null ? s.carrySource : undefined,
    };
  };
  const items = groupTools(list, groupOrder, toolOrder).flatMap(({ key, tools: group }) =>
    slotsOf(group, shown, stackOf, placed).map((slot): ToolRailItem => (slot.kind === 'tool'
      ? button(slot.tool, key)
      : { id: slot.members[0].id, group: key, members: slot.members.map((t) => button(t, key)) })));

  return (
    <>
      <ToolRail
        items={items}
        orientation={orientation}
        columns={columns}
        stackCycle={stackCycle}
        aria-label={ariaLabel}
        className={className}
        disabled={disabled}
        disabledReason={ownReason}
      />
      {carry.ghost}
    </>
  );
}
