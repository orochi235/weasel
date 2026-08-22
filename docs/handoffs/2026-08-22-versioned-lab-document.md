# Versioned lab document — handoff

**Branch:** `feat/versioned-lab-document`, in the worktree
`/Users/mike/src/weasel-lab-document`. 12 commits ahead of `main`.
**Committed, not pushed, not merged.** 315 tests green,
`tsc -p tsconfig.lib.json` clean apart from two pre-existing unrelated
errors (`scripts/build-dts.mts`, `src/theme/Interstellar.stories.tsx`).

Spec: `packages/labkit/docs/superpowers/specs/2026-08-22-versioned-lab-document-design.md`
Plan: `packages/labkit/docs/superpowers/plans/2026-08-22-versioned-lab-document.md`

Both are current — the plan was corrected mid-execution and the spec was
amended once (see below).

## What shipped

labkit persists a lab as one versioned document at `lk:<storageKey>:doc`
instead of four unversioned keys, with a migration chain that folds a legacy
lab forward on first load and deletes the old keys only after reading the new
document back.

## Decisions made in conversation, not visible in the code

**The migration chain is internal, against what the spec first said.** The
spec put `migrations` on `CreateLabStoreOptions` indexed by from-version.
labkit owns those integers and the vocabulary refresh already claims 1 → 2,
so a consumer array on the same indices collides at the next bump. A
consumer migrating its own instrument state has `Instrument.deserialize`.
The spec was amended to match.

**The document key carries a `:doc` suffix** because `lk:<key>` aliases
`lk:<key>:<bucket>`. A lab named `a:saves` and a lab named `a` would
otherwise share a key, and the fold would delete the other lab's document.
Do not "simplify" the suffix away.

**Deleting the legacy keys and writing the quarantine copy are both
read-back-guarded.** `StorageAdapter.write` returns `void` and
`localStorageAdapter` swallows quota failures — and the fold is exactly when
storage is most pressured, since both copies coexist. An unverified delete
there is silent, total, unrecoverable data loss. If either guard looks like
ceremony later, it is not.

**A future-version document is left byte-identical and disables
persistence.** It is deliberately *not* quarantined: moving newer data into
a slot that later corruption overwrites is worse than leaving it alone.

## Next

Three labkit specs are queued and **the order matters**:

1. `2026-08-22-vocabulary-refresh-design.md` — Workspace→Trial, WorkspaceGrid→Workspace,
   useExperimentState→useTrialState. Ships as this document's migration 1 → 2;
   that is why it had to come second, not first.
2. `2026-08-22-tuning-rail-design.md` — written in the renamed vocabulary.
3. `2026-08-22-surface-scheduler-design.md` — same.

`packages/labkit/docs/IDEAS.md` indexes all four and keeps the two ideas that
were not promoted (scratch controls, Sweep).

## Open bug found along the way, deliberately out of scope

**`registerSerializers` has no callers anywhere in the repo.** `serializers`
is permanently `{}`, so `Instrument.serialize` / `deserialize` never run — not
at flush, not at hydrate. This branch neither depends on it nor makes it
worse; migrations operate on already-serialized JSON.

It is not a one-liner: `createLabStore` runs before any React provider
mounts, so hydration cannot see a late registration. A working fix probably
takes serializers as a constructor option instead. Not yet in `docs/TODO.md`
— a concurrent session was editing that file, so it was left alone rather
than risk a conflict.
