/**
 * How a painter asks for part of a node's paint to land on top of the node's
 * children: a container's label, a frame's title, a badge. A scene walk draws
 * a node before its children, so anything else a container paints is covered
 * by them.
 */
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';

const OVER = new WeakSet<object>();

/**
 * `cmds` as one command a scene walk paints after the node's children. Return
 * it among a `drawOne`'s other commands. Outside a scene walk it is an
 * ordinary group, painted where it sits in the list.
 */
export function overChildren(cmds: DrawCommand[]): DrawCommand {
  const group: GroupDrawCommand = { kind: 'group', children: cmds };
  OVER.add(group);
  return group;
}

/** Whether `cmd` came from {@link overChildren}. */
export function isOverChildren(cmd: DrawCommand): boolean {
  return OVER.has(cmd);
}

const NOTHING: DrawCommand[] = [];

/** `cmds` as what paints under the node's children and what paints over them.
 *  A list asking for nothing over comes back as `under` itself. */
export function splitOverChildren(cmds: DrawCommand[]): { under: DrawCommand[]; over: DrawCommand[] } {
  if (!cmds.some(isOverChildren)) return { under: cmds, over: NOTHING };
  const under: DrawCommand[] = [];
  const over: DrawCommand[] = [];
  for (const cmd of cmds) {
    if (isOverChildren(cmd)) over.push(...(cmd as GroupDrawCommand).children);
    else under.push(cmd);
  }
  return { under, over };
}
