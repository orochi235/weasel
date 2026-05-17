# Registry unification — Phase 14c.3: per-kind insert geometry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the AABB-stub shape factories for `line` / `polygon` / `star` / `pencil` in the kit-side insert dep (`src/canvas/SceneCanvas.tsx` insertDep factory map) with real per-kind geometry that uses tool-supplied parameters rather than inscribing in the drag-rect bounds.

**Architecture:** Two changes:
1. Extend the `insertAction` gesture-binding contract so tools can pass per-kind `params` alongside the drag bounds. The Action descriptor already accepts `BindingOpts.params`; tools just need to populate them.
2. Update the kit-side insertDep factory map to read those params for `line` (endpoints), `polygon` (sides + rotation), `star` (innerRadius + points + rotation), and `pencil` (sample list). When params are absent, factories fall back to the current inscription approximations (so old call sites don't break).

**Tech Stack:** TypeScript, React. Builds on Phases 14a–14c.2.

---

## Current state

See `src/canvas/SceneCanvas.tsx` around line 1048 — the `useDepSource('insert', ...)` block. Each shape kind has a `// TODO(Phase 14c.3)` comment explaining the AABB approximation in use today:

- **line**: uses bounds diagonal as line endpoints (drag from top-left to bottom-right always; can't draw bottom-left → top-right line).
- **polygon**: inscribes a regular hexagon (sides=6, rotation=0) in the bounds. Tool's true side count and rotation are lost.
- **star**: inscribes a 5-point star with innerRadius=outerRadius*0.5. Tool's points/innerRadius/rotation are lost.
- **pencil**: inserts a stub rectangle. The freehand sample path is completely lost.

## File map

**Modify:**
- `src/interactions/actions/defaults/insert.ts` — the `insertAction` descriptor. Type its `params` more precisely with a discriminated union keyed by `kind`.
- `src/canvas/SceneCanvas.tsx` — the insertDep factory map (line 1048 area). Read per-kind params from the commit call.
- `src/canvas/deps/useInsertDepSource.ts` (if Phase 15 has extracted it; otherwise same SceneCanvas block) — InsertDep.commit signature gains an optional third arg for per-kind extras.
- `src/interactions/actions/depSchema.ts` — `InsertDep.commit` signature update.
- `src/tools/builtin/useLineTool/useLineTool.tsx` — capture true endpoints from the drag gesture, pass via binding params.
- `src/tools/builtin/usePolygonTool/usePolygonTool.tsx` — pass sides + rotation from tool state.
- `src/tools/builtin/useStarTool/useStarTool.tsx` — pass points + innerRadius + rotation.
- `src/tools/builtin/usePencilTool/usePencilTool.tsx` — capture pointermove samples, pass as a polyline.

**Test:**
- `src/canvas/SceneCanvas.smoke.test.tsx` — flip the remaining skipped tests if Phase 14c.3 unblocks them (useStarTool was the one explicitly noted as needing a keybinding, which is separate; check others).
- New per-tool tests asserting the inserted node carries the right geometry data.

## Scope boundaries

- Only the four kinds listed (line, polygon, star, pencil). Rect/ellipse already use bounds correctly.
- Doesn't change the insertAction's invoker timing (still immediate-on-commit).
- Doesn't introduce a generalized "tool-state-to-action-params" abstraction. Each tool passes what it needs.
- Doesn't add interactive previews (e.g., showing the star points snap-rotating during drag). That's UI polish, separate.

## Tasks

### Task 1: Type the insert params

In `src/interactions/actions/depSchema.ts`, change `InsertDep.commit` from:

```ts
commit(bounds: Rect, kind: string): NodeId | null;
```

to:

```ts
type InsertExtras =
  | { kind: 'rect' }
  | { kind: 'ellipse' }
  | { kind: 'line'; a: Point; b: Point }
  | { kind: 'polygon'; sides: number; rotation: number }
  | { kind: 'star'; points: number; innerRadiusRatio: number; rotation: number }
  | { kind: 'pencil'; samples: Point[] }
  | { kind: string };  // open for consumer extensions

commit(bounds: Rect, extras: InsertExtras): NodeId | null;
```

Decide on naming (`InsertExtras` / `InsertParams` / inline). Keep the `bounds` param even when extras carry richer info — it's still useful for bounding-box pose.

### Task 2: insertAction descriptor signature

In `src/interactions/actions/defaults/insert.ts`, the invoker's `run` reads `bounds` + `params` and calls `dep.commit(bounds, params)`. Type `params: InsertExtras`. Tools populate via `BindingOpts.params` on the binding.

### Task 3: Per-tool migration — line

`useLineTool`'s drag captures `startPoint` and `endPoint` in world coords. Pass these as `params.a` and `params.b`:

```ts
bindings: [
  { spec: { kind: 'drag', target: 'empty' }, actionId: 'insert',
    params: (ctx) => ({ kind: 'line', a: ctx.dragStart, b: ctx.dragEnd }) },
],
```

(Adapt to actual binding params API — may need a `paramsThunk` taking the gesture context, or static params if the binding system doesn't support dynamic ones yet. If dynamic params aren't supported, that's a small dispatcher extension needed first.)

### Task 4: Per-tool migration — polygon

`usePolygonTool` has tool state for `sides` (e.g., 6) and possibly `rotation`. Pass them:

```ts
params: (ctx, toolState) => ({
  kind: 'polygon',
  sides: toolState.sides,
  rotation: toolState.rotation ?? 0,
}),
```

### Task 5: Per-tool migration — star

`useStarTool` has `points`, `innerRadiusRatio`, `rotation` in tool state. Pass them through.

### Task 6: Per-tool migration — pencil

`usePencilTool` needs to capture pointermove samples during the drag. Two options:
- (a) Sample collection happens in the tool's onMove handler; binding params pull from a per-gesture buffer.
- (b) Dispatcher exposes the pointer trail as part of the gesture context; binding params reads from it.

Option (a) is smaller and tool-local. Go with (a) unless the dispatcher already has a trail-recording mechanism (check `src/interactions/dispatcher/dispatcher.ts` first).

The pencil factory then builds a path from `samples`:

```ts
case 'pencil':
  data = { path: polylinePath(extras.samples), fill: 'none', stroke: fill, strokeWidth: 2 };
  break;
```

(Look for an existing `polylinePath` helper; if absent, write one or use the existing `rectPath`/`linePath` patterns as templates.)

### Task 7: Factory map update

In `src/canvas/SceneCanvas.tsx` (or `src/canvas/deps/useInsertDepSource.ts` after Phase 15), replace each kind's TODO-marked stub with the real geometry. Keep the AABB fallback path for when `extras` doesn't have the rich fields (consumer extension safety net).

### Task 8: Smoke tests

Re-evaluate the 3 skipped tests in `SceneCanvas.smoke.test.tsx`:
- useStarTool — was skipped because no default keybinding. Either give it one (and re-enable) or document and leave skipped.
- The other previously-skipped tests should already be passing after Phase 14b/dispatcher-fallthrough; verify.

Add new tests asserting the inserted node's `data.path` reflects the true tool params (not the AABB inscription). E.g., a line drag from (10, 50) to (100, 10) inserts a node whose linePath uses those exact endpoints, not the AABB diagonal.

### Task 9: Verify + commit

- `npm run prepublishOnly` green.
- Demo (`npm run build:demo`) shows correct shape rendering for all four kinds.
- Manual visual smoke: open the dev kit (`npm run dev:kit`), use each tool, verify rendered shape matches tool config. (If running headless, screenshot via storybook stories instead.)
- One commit per tool migration, plus the type/insertAction commit, plus the factory-map commit. Easier to review than one bulk commit.

## Done criteria

- All four kinds (line, polygon, star, pencil) render with their true tool params, not AABB inscription.
- Existing tests pass; new geometry tests added.
- AABB fallback retained for consumer-defined kinds.
- TODO(Phase 14c.3) markers in `src/canvas/SceneCanvas.tsx` removed.

## Risks

- **Dispatcher params plumbing.** If binding params can't access live tool state or gesture context, that needs a small dispatcher extension before Tasks 3–6 are feasible. Investigate first; if needed, do it as Task 0.
- **Pencil sample volume.** A fast freehand stroke can produce hundreds of samples; the resulting node's `data.path` may be heavy. Consider whether the path should be simplified (Douglas–Peucker) at commit time. If unsure, ship raw samples — simplification is a separate optimization.
- **Branded type or layer-kind coupling.** Some scene layers may reject certain `data` shapes. Test with the kit's default scene config before extending.

## What's next

Nothing structurally required. After 14c.3 the kit's built-in tools all produce faithful geometry through the unified dispatcher path. Future work: interactive previews, snap behaviors, additional shape kinds — all consumer-extensible.
