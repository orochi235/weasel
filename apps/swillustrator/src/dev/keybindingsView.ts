export interface KeyShortcut {
  key: string;
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Shape of a `tool.select.*` action's `defaultBinding` as written by
 *  `makeToolSelectAction`. Uses `mod/alt/shift` directly (same as `KeyBinding`)
 *  rather than the `GestureSpec` `mods?: ModSpec` shape. */
interface ToolSelectBinding {
  kind: 'key';
  key: string | string[];
  mod?: boolean;
  alt?: boolean;
  shift?: boolean | 'optional';
}

/** Look up the keyDown shortcut for activating a tool. Reads the
 *  `tool.select.<toolId>` action from the registry — returns undefined
 *  if no such action exists or its binding isn't a `kind: 'key'` spec. */
export function lookupShortcutByToolId(
  toolId: string,
  actions: readonly { id: string; defaultBinding?: unknown }[],
): KeyShortcut | undefined {
  const a = actions.find((x) => x.id === `tool.select.${toolId}`);
  const b = a?.defaultBinding as ToolSelectBinding | undefined;
  if (!b || b.kind !== 'key') return undefined;
  // key may be string or array; take first element if array.
  const key = Array.isArray(b.key) ? b.key[0] : b.key;
  if (key === undefined) return undefined;
  return {
    key,
    ...(b.mod !== undefined && { mod: b.mod }),
    ...(b.alt !== undefined && { alt: b.alt }),
    ...(b.shift !== undefined && { shift: b.shift }),
  };
}
