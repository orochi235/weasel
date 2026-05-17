# Registry unification — Phase 14f: `gestureBinding` → `defaultBinding` rename + cosmetic cleanup

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Final cosmetic pass. Rename `gestureBinding → defaultBinding` kit-wide (the spec end-state name). Delete the now-orphaned legacy `Action.defaultBinding: KeyBinding` field. Final docs/taxonomy.md polish. Close out the registry-unification entry in TODO.md.

**Prerequisites:** Phase 14e-deletions must have shipped — specifically, `Action.run` and the legacy `Action.defaultBinding: KeyBinding` field must already be deleted (or this rename collides with the existing field of the same name).

## Sub-tasks

### Task 1: Rename audit

`grep -rn "gestureBinding" src/ apps/ demo/ packages/ docs/ | wc -l` — get the count. Expect ~80–150 callsites across:
- `src/interactions/actions/registry.tsx` (the field declaration)
- Every default action descriptor (~40 files)
- Every tool with `Tool.bindings` (~10 files)
- Tests
- Docs (TODO.md, taxonomy.md, every Phase plan)

### Task 2: Type-level rename

In `src/interactions/actions/registry.tsx`:
- Rename `Action.gestureBinding` → `Action.defaultBinding`
- Update JSDoc accordingly (drop the transitional `gestureBinding` note)

### Task 3: Mechanical kit-wide rename

```
git -C <worktree> grep -l "gestureBinding" | xargs sed -i '' 's/gestureBinding/defaultBinding/g'
```

(macOS sed flavor. Adjust for portability.)

Then verify:
- `npx tsc --noEmit` — clean (every callsite renamed cleanly).
- `npx vitest run` — every test passes.

### Task 4: Docs

- `docs/taxonomy.md` — remove the "narrower historical definition" + transitional caveats. The taxonomy now reflects reality cleanly.
- `docs/TODO.md` — close out the Phase status block. Either delete the entire "Unify the registry" item (it's done; git log is the archive) OR leave a one-line retrospective entry.
- Any Phase plan docs (`docs/superpowers/plans/2026-05-*-registry-unification-*`) — these are historical, leave as-is.

### Task 5: BoundGesture cleanup

Phase 4 T4's `BoundGesture` type (`GestureSpec | { spec, opts }`) was introduced as a workaround. Phase 14f can either keep it (it's a useful shape) or inline it. Keep — it's a useful exported type.

### Task 6: Verify + commit

Full prepublishOnly green. Build:demo green. Commit message: `feat(registry): rename gestureBinding → defaultBinding — registry unification complete`.

## Done criteria

- `gestureBinding` appears nowhere in the codebase (except possibly historical plan docs).
- `Action.defaultBinding` is the canonical name, typed as `GestureSpec | BoundGesture[] | undefined` (the post-Phase-14e shape, after `KeyBinding` was deleted).
- All tests pass; tsc clean.
- TODO.md's registry unification entry is closed out.
- taxonomy.md has no historical caveats about action vs gesture.

## Risks

- **Mechanical rename hitting docs.** Plan files reference `gestureBinding` — keep those historical. The sed should target only `src/`, `apps/`, `demo/`, `packages/` (NOT `docs/`).
- **Test snapshot files / vitest fixtures.** Any snapshot referencing `gestureBinding` will need re-snapshotting. Be ready for that.

## What's next

Nothing. Registry unification is done.
