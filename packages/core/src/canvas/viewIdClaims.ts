import type { ViewRegistration } from './viewRegistry';

/**
 * `ViewRegistry.register` over a registry's entries, keeping view ids unique: a view whose id another holds
 * waits, and the first waiting takes the id when it frees.
 */
export function createViewIdClaims(entries: {
  get: (id: string) => ViewRegistration | undefined;
  add: (reg: ViewRegistration) => void;
  /** Whether `reg` was registered. */
  remove: (reg: ViewRegistration) => boolean;
  changed: () => void;
}): (reg: ViewRegistration) => () => void {
  const { get, add, remove, changed } = entries;
  /** Views skipped for an id another view holds, in the order they arrived. */
  const waiting: ViewRegistration[] = [];
  /** A waiting view handed an id this task. A view rebuilding its registration releases the old one and
   *  registers the new one in the same commit, so a claim arriving before the task ends takes the id back. */
  let handedOn: ViewRegistration | null = null;
  return (reg) => {
    const holder = get(reg.id);
    if (holder && holder === handedOn) {
      handedOn = null;
      remove(holder);
      waiting.unshift(holder);
      add(reg);
    } else if (holder && holder !== reg) {
      console.error(`[weasel] <CanvasView id="${reg.id}">: another view on this canvas already has that id, so this one is skipped until that view goes away. View ids are unique per canvas; rename one.`);
      waiting.push(reg);
    } else add(reg);
    return () => {
      const at = waiting.indexOf(reg);
      if (at >= 0) { waiting.splice(at, 1); return; }
      if (!remove(reg)) return;
      const next = waiting.findIndex((r) => r.id === reg.id);
      if (next < 0) { changed(); return; }
      const promoted = waiting.splice(next, 1)[0]!;
      add(promoted);
      handedOn = promoted;
      queueMicrotask(() => { if (handedOn === promoted) handedOn = null; });
    };
  };
}
