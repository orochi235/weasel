type Entry = readonly [key: string, json: string];

/**
 * Write the scene and the undo stacks recorded against it, best-effort. A
 * history that fails to save after its scene did is removed along with the
 * other stacks, because an older stack would replay against the wrong scene.
 * When the scene itself fails, the previous scene and its stacks stay as
 * they are. Answers whether the scene was saved.
 */
export function writeSession(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  scene: Entry,
  histories: readonly Entry[],
): boolean {
  try {
    storage.setItem(scene[0], scene[1]);
  } catch {
    return false;
  }
  try {
    for (const [key, json] of histories) storage.setItem(key, json);
  } catch {
    for (const [key] of histories) {
      try { storage.removeItem(key); } catch { /* best-effort */ }
    }
  }
  return true;
}
