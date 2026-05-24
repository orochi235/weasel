export interface KeyShortcut {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Shape of one `BoundGesture` entry on the consolidated `tool.activate`
 *  action's `defaultBinding`. Each entry pairs a key spec with
 *  `opts.params.toolId` so this helper can find the entry for a given tool. */
interface ToolActivateBoundEntry {
  spec: {
    kind: string;
    key?: string | string[];
    mod?: boolean;
    alt?: boolean;
    shift?: boolean | 'optional';
  };
  opts: { params: { toolId: string } };
}

/** Look up the keyDown shortcut for activating a tool. Walks the
 *  consolidated `tool.activate` action's `defaultBinding[]`, finds the
 *  entry whose `opts.params.toolId` matches, and returns its key spec.
 *  Returns undefined when no `tool.activate` action exists or no entry
 *  matches the given `toolId`. */
export function lookupShortcutByToolId(
  toolId: string,
  actions: readonly { id: string; defaultBinding?: unknown }[],
): KeyShortcut | undefined {
  const action = actions.find((x) => x.id === 'tool.activate');
  const bindings = action?.defaultBinding;
  if (!Array.isArray(bindings)) return undefined;

  for (const raw of bindings) {
    const entry = raw as Partial<ToolActivateBoundEntry>;
    if (!entry.opts || !entry.spec) continue;
    if (entry.opts.params?.toolId !== toolId) continue;
    if (entry.spec.kind !== 'key') return undefined;
    const key = Array.isArray(entry.spec.key) ? entry.spec.key[0] : entry.spec.key;
    if (key === undefined) return undefined;
    return {
      key,
      ...(entry.spec.mod !== undefined && { mod: entry.spec.mod }),
      ...(entry.spec.alt !== undefined && { alt: entry.spec.alt }),
      ...(entry.spec.shift !== undefined && { shift: entry.spec.shift }),
    };
  }
  return undefined;
}
