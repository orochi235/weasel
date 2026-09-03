# Annotations arc 3d — persistence, undo, and meaning

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Marks survive a reload, Cmd+Z takes one back, and a mark can say what it means.

**Architecture:** Weasel history stays the undo authority — labkit routes to it rather than snapshotting alongside. The store gains an ordering across its per-target scenes, keyed off each scene's `historyIndex()`, so undo takes back the last change wherever it was made. Persistence writes `store.toJSON()` into a trial slot of labkit's own on a trailing debounce; the meaning tier is chrome over fields the store already carries.

**Scope boundary.** 3d closes arc 3. Capture is arc 4 and brick-icons is arc 5. Undo history itself is **not** persisted — `Scene.serializeHistory()` exists, but a reload restoring an undo stack over marks is a separate decision, and the arc does not need it.

**Tech stack:** React 19, TypeScript, zustand, `@weasel-js/core` (`Scene` history), vitest (`--project=labkit`), Playwright for the reload.

**Spec:** `docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`, arc 3.

---

## Deviations from the spec

- **Marks get a trial slot of their own, not `record.state`.** The spec puts them in `record.state` as "the only persisted instrument slot" — but that slot is the *instrument's* state, typed `TS`, and labkit writing its own payload into it corrupts a shape the instrument owns. `TrialRecord.annotations` is additive and optional, so an old document lacks the field and needs no migration. The spec's two constraints still bind: the payload is JSON-safe, and it versions itself.
- **An instrument may still own the storage.** `annotations.storage` takes a `load`/`save` pair; declaring it means labkit never touches its own slot. This is what lets brick-icons keep writing its TOML.

---

## File structure

**Created — `packages/labkit/src/annotations/`**
- `history.ts` + `history.test.ts` — the cross-target undo ordering
- `MarkList.tsx` — the sidebar panel: every mark, its status, its staleness
- `Annotations.meaning.test.tsx` — the panel over a store

**Modified**
- `packages/labkit/src/annotations/store.ts` — `undo`/`redo`/`canUndo`/`canRedo`; a mutation counter per scene
- `packages/labkit/src/annotations/types.ts` — `AnnotationStorage` on the capability; the four history methods on the API
- `packages/labkit/src/annotations/paint.ts` — a status's color, and a stale mark's treatment
- `packages/labkit/src/state/types.ts` — `annotations?: unknown` on `TrialRecord`
- `packages/labkit/src/state/store.ts` — `updateTrialAnnotations`
- `packages/labkit/src/state/document.ts` — carry the field through serialize/deserialize
- `packages/labkit/src/trial/Trial.tsx` — seed the store from the slot, write back debounced, route undo
- `packages/labkit/src/chrome/builtins.tsx` — the mark list, and undo/redo for an annotating instrument
- `packages/labkit/src/index.ts` + `index.test.ts`
- `packages/labkit/examples/annotate-lab/*` — exercise all three

---

### Task 1: undo, across targets

- [ ] **Failing test first** (`history.test.ts`): with marks added to two targets in a known order, `undo()` takes back the most recent one **wherever it was made**, then the one before it on the other target; `redo()` puts them back in the reverse order; `canUndo()` is false at the bottom and `canRedo()` false at the top. Plus: a new mark after an undo drops the redo stack.
- [ ] Track ordering off each scene's `historyIndex()`, not off the subscribe callback alone — a scene notifies on ephemeral changes too, and an undo driven from inside a pane's own keymap must move this ordering rather than append to it. Assert that: an undo called on a scene directly (as a pane's Cmd+Z does) leaves the store's `canRedo()` true.
- [ ] Implement on the store; export the four methods on `AnnotationsApi`.
- [ ] Tests pass; commit.

### Task 2: marks survive a reload

- [ ] **Failing test first** (`store.test.ts` / `Trial.annotations.test.tsx`): a lab given a memory storage adapter, with a mark added, re-mounted from that same adapter, has the mark back — same id, same `frac`, same `seen`. And: a trial whose instrument declares `storage` writes nothing to the labkit slot and reads from the instrument's pair instead.
- [ ] Add `annotations?: unknown` to `TrialRecord`; carry it through `SerializedTrial`, `serializeTrials` and the document read. **No version bump** — the field is optional, and an old document simply lacks it. Assert a v3 document without the field still loads.
- [ ] Add `updateTrialAnnotations` to the lab store.
- [ ] In `Trial`, seed the store from the slot on first build (`annotationsFromJSON`), and subscribe to write `toJSON()` back on a **trailing debounce**. The store's own storage flush is already debounced, but the zustand `set` is not: a write per scene notify re-renders every trial on every frame of a drag. Flush on unmount too, or the last mark before a close is lost.
- [ ] Tests pass; commit.

### Task 3: what a mark means

- [ ] **Failing test first** (`Annotations.meaning.test.tsx`): an instrument declaring `meaning.statuses` gets a sidebar panel listing its marks; picking a status writes it through `update`; a mark whose `positionDependsOn` values have changed is shown as stale. An instrument declaring `annotations` without `meaning` gets the list with no status control rather than no list.
- [ ] `MarkList.tsx` — reads `useAnnotations()`, which already re-renders on mutation. Rows are the marks; each names its target, its kind, its title.
- [ ] `paint.ts` takes a status → color map so a mark reads as what it means. A stale mark draws dashed: it still describes *something*, and hiding it would lose it.
- [ ] Contribute the panel from `chrome/builtins.tsx` when `instrument.annotations != null`.
- [ ] Tests pass; commit.

### Task 4: gate

- [ ] `npx tsc --noEmit && npm run lint && npm test`, foreground, output read. `cd packages/labkit && npm run lint` too — the root script is eslint and does not run biome.
- [ ] `npx playwright test --config=tests/visual/playwright.config.ts`.
- [ ] **Drive the annotate-lab in a browser**: draw, reload, see the marks come back; undo across two panes; set a status and watch the color follow. jsdom cannot see any of it, and the last arc shipped three defects a green suite had missed.
- [ ] Screenshot to the slopboard wall.
- [ ] Changeset, `patch`. `npm run check:bumps`.

---

## Merging

`git merge main` then `git -C .claude/worktrees/trunk merge --ff-only labkit/annotations`. Leave that worktree. **`main` has never been pushed; pushing needs Mike's explicit say-so.** Delete this plan in the merge.
