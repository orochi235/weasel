/**
 * Every key live in an actions scope, as a shortcut sheet lists it: the tool
 * keys by tool set, the command keys by action group, and the keys held to
 * keep something on. Read from the bindings in force, so a rebound key reads
 * rebound and an unbound one is gone.
 */
import type { IconSpec } from '@weasel-js/icons';
import type { MenuShortcut } from '@weasel-js/menu';
import type { Action } from '../interactions/actions/action';
import { actionBindings } from '../interactions/actions/binding';
import { actionItems, actionItemTitle, type ActionItem } from '../interactions/actions/actionItems';
import { actionShortcuts } from '../interactions/actions/actionShortcuts';
import { resolveParams } from '../interactions/actions/invoker';
import { TOOL_OFFHAND_ID } from '../interactions/actions/toolOffhand';
import { TOOL_ACTIVATE_ID, toolShortcutsOf } from './toolShortcuts';
import { toolIdsOf, type ToolSet } from './toolSet';
import type { AnyTool } from './types';

/** One line of a sheet: what it is, and the keys that reach it. */
export interface ShortcutRow {
  /** A tool's id, an action entry's key (`ActionItem.key`), or `<action>:<toolId>` for a held tool. */
  id: string;
  label: string;
  icon?: IconSpec;
  /** Every key bound to it, first the one a chip shows. Empty for a tool with none. */
  shortcuts: readonly MenuShortcut[];
}

/** A titled run of rows. */
export interface ShortcutGroup {
  /** The tool set's id, or the action group. */
  id: string;
  label: string;
  rows: readonly ShortcutRow[];
}

/** {@link describeShortcuts}'s result. */
export interface ShortcutsDescription {
  /** One group per tool set, then `other` for registered tools in none. Every tool is listed, keyed or not. */
  tools: readonly ShortcutGroup[];
  /** The actions a pressed key runs, by `Action.group` in first-registered order, ungrouped last as `other`. */
  commands: readonly ShortcutGroup[];
  /** What a key held down keeps on: a tool held on its key, or an action bound to `keyHeld`. */
  held: readonly ShortcutRow[];
}

/** What a sheet reads of a tool: its name and glyph. */
export type ShortcutTool = Pick<AnyTool, 'presentation'>;

/** Options for {@link describeShortcuts}. */
export interface DescribeShortcutsOptions {
  /** The tools registered, by id: what names and draws each tool's row. Absent, there are no tool rows, and a held
   *  tool reads as its id. */
  tools?: Readonly<Record<string, ShortcutTool>>;
  /** The sets the tool rows are grouped by, in order. A tool in two is listed in the first; sets sharing an id are
   *  one group, headed by the first label given. Tools in none follow under "Other tools". */
  toolSets?: readonly ToolSet[];
}

const NONE: readonly MenuShortcut[] = Object.freeze([]);
const OTHER = 'other';

/** A group id as a heading: `path-edit` reads `Path edit`. */
function groupTitle(id: string): string {
  const words = id.replace(/[-_.]+/g, ' ').trim();
  return words.length === 0 ? id : words[0]!.toUpperCase() + words.slice(1);
}

function toolRow(id: string, tool: ShortcutTool, keys: readonly MenuShortcut[] | undefined): ShortcutRow {
  const icon = tool.presentation?.icon;
  return { id, label: tool.presentation?.label ?? id, ...(icon ? { icon } : {}), shortcuts: keys ?? NONE };
}

function describeTools(
  actions: readonly Action[], tools: Readonly<Record<string, ShortcutTool>>, sets: readonly ToolSet[],
): ShortcutGroup[] {
  const shown = Object.keys(tools).filter((id) => !tools[id]!.presentation?.hide);
  const keys = toolShortcutsOf(actions, shown);
  const placed = new Set<string>();
  const groups = new Map<string, { label: string; rows: ShortcutRow[] }>();
  const take = (groupId: string, label: string, ids: readonly string[]): void => {
    const group = groups.get(groupId) ?? { label, rows: [] };
    groups.set(groupId, group);
    for (const id of ids) {
      if (placed.has(id) || !shown.includes(id)) continue;
      placed.add(id);
      group.rows.push(toolRow(id, tools[id]!, keys[id]));
    }
  };
  for (const set of sets) take(set.id, set.label ?? groupTitle(set.id), toolIdsOf([set]));
  take(OTHER, sets.length === 0 ? 'Tools' : 'Other tools', shown);
  return [...groups].filter(([, g]) => g.rows.length > 0).map(([id, g]) => ({ id, ...g }));
}

/** The entries an action lists under: its variants', or the action itself when it has none or cannot be triggered. */
function entriesOf(action: Action): readonly ActionItem[] {
  const items = actionItems(action);
  return items.length > 0 ? items : [{ key: action.id, action, label: action.label, ...(action.icon ? { icon: action.icon } : {}), tags: [] }];
}

function entryRow(item: ActionItem, shortcuts: readonly MenuShortcut[]): ShortcutRow {
  return { id: item.key, label: actionItemTitle(item), ...(item.icon ? { icon: item.icon } : {}), shortcuts };
}

/** A row per tool `offhand` holds on a key, named for the tool. */
function heldTools(offhand: Action, tools: Readonly<Record<string, ShortcutTool>>): ShortcutRow[] {
  const ids = new Set<string>();
  for (const b of actionBindings(offhand)) {
    const toolId = resolveParams(b.opts?.params)?.toolId;
    if (typeof toolId === 'string') ids.add(toolId);
  }
  const rows: ShortcutRow[] = [];
  for (const toolId of ids) {
    const shortcuts = actionShortcuts(offhand, { toolId }, 'keyHeld');
    if (shortcuts.length === 0) continue;
    const tool = tools[toolId];
    rows.push(tool ? { ...toolRow(toolId, tool, shortcuts), id: `${offhand.id}:${toolId}` } : { id: `${offhand.id}:${toolId}`, label: toolId, shortcuts });
  }
  return rows;
}

/**
 * The keys `actions` bind (an actions registry's `list()`), as a shortcut sheet lists them. A key with a required
 * Ctrl or Meta has no chip form (`keySpecShortcut`) and is left out, and a pointer gesture is never listed.
 */
export function describeShortcuts(actions: readonly Action[], opts: DescribeShortcutsOptions = {}): ShortcutsDescription {
  const tools = opts.tools ?? {};
  const commands = new Map<string, ShortcutRow[]>();
  const held: ShortcutRow[] = [];
  for (const action of actions) {
    if (action.id === TOOL_ACTIVATE_ID) continue;
    if (action.id === TOOL_OFFHAND_ID) {
      held.push(...heldTools(action, tools));
      continue;
    }
    for (const item of entriesOf(action)) {
      const pressed = actionShortcuts(action, item.params, 'key');
      if (pressed.length > 0) {
        const group = action.group ?? OTHER;
        commands.set(group, [...(commands.get(group) ?? []), entryRow(item, pressed)]);
      }
      const down = actionShortcuts(action, item.params, 'keyHeld');
      if (down.length > 0) held.push(entryRow(item, down));
    }
  }
  const other = commands.get(OTHER);
  commands.delete(OTHER);
  if (other) commands.set(OTHER, other);
  return {
    tools: opts.tools ? describeTools(actions, tools, opts.toolSets ?? []) : [],
    commands: [...commands].map(([id, rows]) => ({ id, label: id === OTHER ? 'Other' : groupTitle(id), rows })),
    held,
  };
}
