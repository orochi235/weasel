import { Fragment, useRef, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import {
  BUILTIN_TOOL_IDS, TOOL_GROUP_ORDER, startCarry, toolSetHas, type CarryPayload, type Tool, type ToolSet, type ToolsApi,
} from '@weasel-js/core';
import { eligibleContribution, type ModeRegistry } from '@weasel-js/modes';
import { ToolButton } from '../ToolButton';
import { ToolGroup } from '../ToolGroup';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import s from './ToolPalette.module.css';
import { formatShortcut, type ShortcutInput } from '@weasel-js/gestures';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import { groupTools } from './order';
import { slotsOf, stackIndex, type PaletteSlot } from './stacks';
import { ToolStack, type StackCycleModifier, type StackMember } from './ToolStack';

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
}

/** How far a press moves before it is a carry rather than a click, in CSS pixels. */
const CARRY_SLOP_PX = 4;

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
    groupOrder = TOOL_GROUP_ORDER, toolOrder = BUILTIN_TOOL_IDS, include, ariaLabel = 'Tools', stacks = [], stackCycle = 'alt',
    columns, onToolDragStart, carryTool,
  } = props;
  // Set while the click that ends a carry is still to come, so the carry does not also pick its tool.
  const carried = useRef(false);
  const carryPress = (tool: Tool, e: PointerEvent<HTMLButtonElement>) => {
    const payload = e.button === 0 ? carryTool?.(tool) ?? null : null;
    if (payload === null) return;
    const from = { x: e.clientX, y: e.clientY };
    let moved = false;
    startCarry(e.currentTarget, e, payload, {
      onMove: (m) => { moved ||= Math.hypot(m.clientX - from.x, m.clientY - from.y) > CARRY_SLOP_PX; },
      onEnd: () => {
        if (!moved) return;
        carried.current = true;
        setTimeout(() => { carried.current = false; }, 0);
      },
    });
  };
  const shows = include === undefined ? () => true
    : typeof include === 'function' ? include : (t: Tool) => toolSetHas(include, t.id);
  const list = Object.values(tools.registry).filter((t) => !t.presentation?.hide && shows(t));
  const horizontal = !columns && orientation === 'horizontal';
  const cls = [s.palette, horizontal && s.horizontal, className].filter(Boolean).join(' ');

  const shown = new Map(list.map((t) => [t.id, t]));
  const stackOf = stackIndex(stacks);
  const placed = new Set<readonly string[]>();
  const slotGroups = groupTools(list, groupOrder, toolOrder)
    .map(({ key, tools: group }) => ({ key, slots: slotsOf(group, shown, stackOf, placed) }));
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
    columns,
    groupSelector: '[role="group"]',
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
              aria-orientation={horizontal ? 'vertical' : 'horizontal'}
            />
          )}
          <ToolGroup orientation={orientation} columns={columns} groupKey={key}>
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
                  className={[s.paletteBtn, !enabled && s.ineligibleBtn, carryTool?.(tool) != null && s.carrySource].filter(Boolean).join(' ')}
                  title={resolvedTitle}
                  onClick={enabled ? () => { if (!carried.current) tools.setActive(tool.id); } : () => {}}
                  onPointerDown={carryTool && enabled ? (e) => carryPress(tool, e) : undefined}
                  onDragStart={onToolDragStart && enabled ? (e) => onToolDragStart(tool, e) : undefined}
                />
              );
            })}
          </ToolGroup>
        </Fragment>
      ))}
    </div>
  );
}
