# One versioned lab document — design spec

**Date:** 2026-08-22
**Status:** Draft
**Package paths:** `src/state/`
**Order:** First of four. The vocabulary refresh, the tuning rail and the
surface scheduler all follow; the refresh ships as a migration this spec
introduces.

A lab persists four independent blobs under four keys, none of them
versioned. This replaces them with one document carrying a version and a
migration chain, so a change to the persisted shape stops meaning "every
saved lab silently loses its state."

## What exists

`createLabStore` reads four keys, each with its own `JSON.parse` and its own
catch:

```
lk:<storageKey>:workspaces   → WorkspaceRecord[]   (instrument serializers run per record)
lk:<storageKey>:saves        → SavedSnapshot[]
lk:<storageKey>:layout       → Record<string, unknown>   (opaque tile extents)
lk:<storageKey>:theme        → LabMode
```

Nothing records what shape any of them is in. `layout` was added on
2026-08-22 and is already the fourth; the cost of adding a fifth is another
parse, another catch, and another thing no migration can find.

## The document

One key, `lk:<storageKey>`, holding:

```ts
interface LabDocument {
  version: number;
  /** `Omit<TrialRecord, 'undoStack'>` — undo history still does not persist.
   *  Named `workspaces` until the vocabulary refresh renames it. */
  trials: SerializedTrial[];
  saves: SavedSnapshot[];
  layout: Record<string, unknown>;
  mode: LabMode;
}
```

`version` is the document's, not per-section. A section-level version buys
independent migration of parts that in practice change together — a rename
touches the trial records *and* the key they live under — and costs four
chains to keep in step.

## Migrations

```ts
type Migration = (doc: unknown) => unknown;

interface CreateLabStoreOptions {
  // ...existing
  migrations?: Migration[];   // index i migrates version i → i+1
}
```

Hydrate reads `version`, runs every migration from it to the current
version, and writes the result back. A document from the future — version
higher than the code knows — is left alone and the store starts empty,
rather than being parsed under a shape it may not have.

Two migrations ship with this work:

- **0 → 1: fold the legacy keys.** Version 0 is "no document, four keys."
  The migration reads all four, assembles the document, and deletes them.
  A lab with none of them is a fresh lab, not a failed migration.
- **1 → 2: the vocabulary refresh.** `workspaces` → `trials`. Written in
  the refresh's own work, listed here so the mechanism has its second user
  before it ships.

A migration that throws is caught: the store logs, keeps the raw document
under `lk:<storageKey>:quarantine`, and starts empty. Losing state to a bad
migration is bad; losing it silently is worse, and the quarantined copy is
what makes a bug report possible.

## What changes in `helpers.ts`

`serializeWorkspaces` returns records rather than a string, and
`deserializeWorkspaces` takes records rather than a string — the document is
stringified once, by the store. Per-instrument serializers still run per
record, unchanged. `labStorageKey`'s bucket union survives only for the
legacy read in migration 0 → 1 and the quarantine key.

## Sharing a lab through the URL

With one document, `urlHashAdapter` carries an entire lab as one blob, which
makes a lab's state a link — the cheapest possible bug report for a visual
tool.

It will not fit. `encodeUrlHash` is `btoa(encodeURIComponent(value))` with no
compression, and browsers stop honoring a fragment somewhere between 2 KB and
8 KB depending on which one. A lab with real trial state exceeds that. This
spec names the limit and does not raise it; a compression hook on the adapter
is the obvious lever when someone wants it.

## Testing

- A store written under the four legacy keys hydrates identically through
  migration 0 → 1, and the legacy keys are gone afterward.
- A fresh lab writes a document at the current version and no legacy keys.
- A document at a version above the code's starts empty and does not
  overwrite what is stored.
- A throwing migration quarantines the raw document and starts empty.
- Instrument serializers still round-trip a trial's state through the
  document.
