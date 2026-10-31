/** Edits to a gitgraph, as plain data in and out. */
import type { GitGraphData } from './types';

/** `data` with command `command`'s tag set to `text`, trimmed; an empty one removes it. Throws on a command that
 *  does not exist or makes no commit. */
export function setGitTag(data: GitGraphData, command: number, text: string): GitGraphData {
  const cmd = data.commands[command];
  if (cmd === undefined || cmd.kind === 'branch' || cmd.kind === 'checkout') throw new Error(`setGitTag: command ${command} makes no commit`);
  const tag = text.trim();
  if ((cmd.tag ?? '') === tag) return data;
  const { tag: _, ...rest } = cmd;
  const next = tag === '' ? rest : { ...rest, tag };
  return { ...data, commands: data.commands.map((c, i) => (i === command ? next : c)) };
}
