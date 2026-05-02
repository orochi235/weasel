/**
 * Opaque clipboard payload. `items` is `unknown[]` so each app's clipboard
 * adapter stores whatever shape it wants; the kit never inspects entries.
 *
 * The adapter is responsible for both producing snapshots
 * (`snapshotSelection`) and consuming them (`commitPaste`). Type safety lives
 * at that boundary, not in the kit.
 */
export interface ClipboardSnapshot {
  items: unknown[];
}
