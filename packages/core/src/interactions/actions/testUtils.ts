import type { ActionDeps } from '@weasel-js/routing';
import type { EditAnchorsDep } from './depSchema';

/**
 * Deps for an action unit test, stubbing only the slice the action reads.
 * Such stubs fall short of the full `DepSchema` types an action's deps carry,
 * and this is where they are let through.
 */
export function stubDeps(deps: Record<string, unknown>): ActionDeps {
  return deps as ActionDeps;
}

/**
 * Build an inert {@link EditAnchorsDep} for action unit tests. Every
 * member has a harmless default; override just the ones a test cares
 * about.
 *
 * Anchor selection and the marquee default to a **live** in-memory store
 * rather than a no-op, because most anchor-editing actions read back what
 * they wrote (select-then-nudge, marquee-then-delete). A test that wants
 * to assert the write instead of the round trip can pass its own spies.
 */
export function makeEditAnchorsDep(over: Partial<EditAnchorsDep> = {}): EditAnchorsDep {
  let selected: ReadonlySet<number> = new Set();
  let marquee: EditAnchorsDep['marquee'] = null;
  const base: EditAnchorsDep = {
    editingId: 'node-a',
    setEditingId: () => {},
    getStorageKind: () => 'pose',
    getNodeShape: () => null,
    getEditablePath: () => null,
    applyEdit: () => {},
    get selectedAnchors() {
      return selected;
    },
    setSelectedAnchors(next: Iterable<number>) {
      selected = new Set(next);
    },
    get marquee() {
      return marquee;
    },
    setMarquee(rect) {
      marquee = rect;
    },
  };
  // Spread order matters: an explicit `selectedAnchors` / `marquee`
  // override must win over the accessor pair above, so copy descriptors
  // rather than plain-assigning (a getter would otherwise be clobbered by
  // an undefined value or survive a legitimate override).
  return Object.defineProperties(
    base,
    Object.getOwnPropertyDescriptors(over),
  ) as EditAnchorsDep;
}
