import type { DragEvent, PointerEvent, ReactNode } from 'react';
import type { IconSpec } from '@weasel-js/icons';
import type { MenuShortcut } from '@weasel-js/menu';

interface RailPlaced {
  /** Unique on the rail. */
  id: string;
  /** The run the item sits in. A group gathers its items where its first one sits; ungrouped items between
   *  groups run together; a rule divides each run from the next. */
  group?: string;
}

/** A button on a {@link ToolRail}. */
export interface ToolRailButton extends RailPlaced {
  icon: IconSpec;
  label: string;
  /** What it does: the tooltip reads it in place of `label`. */
  description?: string;
  /** The key that presses it, which the button's chip and tooltip show and a stack's menu row draws. */
  shortcut?: MenuShortcut;
  /** Reads as current: `aria-current`, the pressed look, and the rail's tab stop. */
  active?: boolean;
  disabled?: boolean;
  /** Why it is disabled. Given, the button stays focusable and its tooltip says why; without one it is natively
   *  disabled. */
  disabledReason?: string;
  onPress(): void;
  onPointerDown?(e: PointerEvent<HTMLButtonElement>): void;
  /** Makes the button a drag source. */
  onDragStart?(e: DragEvent<HTMLButtonElement>): void;
  className?: string;
}

/** Buttons sharing one: it shows the active member, else the one last pressed, and a click opens a menu of all
 *  of them. Only the members' presses are used; their pointer, drag and class fields are not. */
export interface ToolRailStack extends RailPlaced {
  members: readonly ToolRailButton[];
}

/** Anything else on the rail, drawn in place. Its controls keep tab stops of their own. */
export interface ToolRailSlot extends RailPlaced {
  render(): ReactNode;
}

/** What a {@link ToolRail} holds. */
export type ToolRailItem = ToolRailButton | ToolRailStack | ToolRailSlot;

/** One rule-divided run of a rail. */
export interface RailRun {
  key: string;
  group?: string;
  items: ToolRailItem[];
}

/** The rail's runs, in the order {@link RailPlaced.group} gives them. */
export function railRuns(items: readonly ToolRailItem[]): RailRun[] {
  const runs: RailRun[] = [];
  const byGroup = new Map<string, RailRun>();
  for (const item of items) {
    if (item.group == null) {
      const last = runs.at(-1);
      if (last && last.group === undefined) last.items.push(item);
      else runs.push({ key: `item:${item.id}`, items: [item] });
      continue;
    }
    let run = byGroup.get(item.group);
    if (!run) {
      run = { key: `group:${item.group}`, group: item.group, items: [] };
      byGroup.set(item.group, run);
      runs.push(run);
    }
    run.items.push(item);
  }
  return runs;
}

export const isStack = (item: ToolRailItem): item is ToolRailStack => 'members' in item;
export const isSlot = (item: ToolRailItem): item is ToolRailSlot => 'render' in item;

/** Whether the item reads as current: a button that is active, or a stack holding one. */
export const isActive = (item: ToolRailItem): boolean =>
  isStack(item) ? item.members.some((m) => m.active) : !isSlot(item) && item.active === true;
