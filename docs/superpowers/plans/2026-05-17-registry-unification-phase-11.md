# Registry unification — Phase 11: fill Phase 7 descriptor stubs

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fill in the 5 stub invokers shipped by Phase 7 (resize, rotate, areaSelect, insert, clone). After this phase, the descriptor path is fully functional for all simple-drag actions, unblocking Phase 10's legacy deletion.

**Architecture:** Mirror `moveAction`'s pattern (Phase 6 T1): per-frame logic reads `scene` dep directly via `scene.batch(...)`/`scene.setPose(...)`. Where the existing hook's logic genuinely needs an adapter contract (areaSelect's hit-test, insert's node factory), augment `DepSchema` with the necessary entry and source it from `<SceneCanvas>` at mount.

**Tech Stack:** TypeScript, Vitest. Builds on Phases 1–9 + 7.5 + 8.5.

---

## Per-stub strategy

| Stub | Path | Notes |
|---|---|---|
| resize | (a) scene-direct | Read existing `useResize` for the remap math. Per-frame translate of bounds via `scene.getPose`/`setPose`. |
| rotate | (a) scene-direct | Read `useRotate` for the rotation math. AABB pivot derivation from `scene.boundsOf(id)` if available, else compute from poses. |
| areaSelect | (b) DepSchema adapter | Add `areaSelect: { hitTestArea(bounds): NodeId[] }` to DepSchema. Source from SceneCanvas synth. |
| insert | (b) DepSchema adapter | Add `insert: { commit(bounds, kind): NodeId }` plus per-binding `params.kind`. Source from SceneCanvas synth. |
| clone | (a) scene-direct | Snapshot via `scene.batch('Clone', ...)` with new-id-mint + translate. May need `scene.deepClone(id) → NodeId` if not present. |

If (a) turns out to be infeasible for any stub (e.g., the existing hook does something genuinely complex), fall back to (b) — add the adapter dep.

## Files

**Modify (the existing stub files):**
- `src/interactions/actions/defaults/resize.ts` + test
- `src/interactions/actions/defaults/rotate.ts` + test
- `src/interactions/actions/defaults/areaSelect.ts` + test
- `src/interactions/actions/defaults/insert.ts` + test
- `src/interactions/actions/defaults/clone.ts` + test

**Possibly modify:**
- `src/interactions/actions/depSchema.ts` — add adapter entries if needed
- `src/canvas/SceneCanvas.tsx` — source the new dep entries
- `src/core/scene/...` — extend scene API if descriptor needs a missing primitive (`deepClone`, `hitTestArea`)

## Scope boundaries

- Doesn't touch `useResize`/`useRotate`/etc. hooks. They stay for now (Phase 10 deletes them after Phase 11 verifies the descriptors work end-to-end).
- Doesn't migrate `useSelectTool`'s route table to use the new descriptors. (Phase 12 or later.)
- Integration tests verify the descriptors work via the dispatcher; the route-table path continues to fire alongside (redundant but harmless).

## Tasks

### Task 1: Fill `resizeAction` invoker
### Task 2: Fill `rotateAction` invoker
### Task 3: Fill `areaSelectAction` invoker (+ depSchema if needed)
### Task 4: Fill `insertAction` invoker (+ depSchema if needed)
### Task 5: Fill `cloneAction` invoker
### Task 6: End-to-end verify + TODO note

Each task: read existing hook → port per-frame logic → update test from stub-shape to behavior-coverage → commit.

## Done criteria

- All 5 descriptors have working invokers.
- Integration tests prove each works via the dispatcher path.
- All existing tests pass; tsc clean; build:demo clean.
- Phase 10's deletion list becomes unblocked.

## Risks

- **Adapter deps surface growth.** If areaSelect/insert need adapters, DepSchema grows by 2. Acceptable.
- **Behaviors pipeline still skipped.** Phase 11 ports the bare action; per-binding behaviors (snap, lockAspect) wait for a later phase.
- **Route-table coexistence.** Both dispatchers fire on the same drag for Phase 11; only the route table's commit lands (the descriptor's commit gets applied second and overwrites — or both apply, depending on ordering). Test carefully — if you see double-application, that's a real bug.
