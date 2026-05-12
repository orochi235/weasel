# Declarative tool routing — Phase 6 (Retire imperative defineTool) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the imperative `defineTool` factory and rename the declarative one to the canonical location (`src/tools/defineTool.ts`). The `/routing` subpath stays for reflection consumers.

**Architecture:** Move `routing/defineTool.{ts,test.ts}` → `defineTool.{ts,test.ts}`. Delete the imperative `defineTool.{ts,test.ts}` first (or as part of the same step). Move the factory-substrate modules `routing/result.ts`, `routing/lookup.ts`, `routing/modifiers.ts`, `routing/hitResult.ts`, `routing/types.ts`, and `routing/defineViewportTool.ts` up one level into `src/tools/`. Reflection consumers (`routing/reflection/*` — registry, conflicts, debug overlay, route-resolved info, `useToolDebugInfo`) stay where they are. The `/routing` subpath barrel narrows to a reflection-only surface; the main barrel grows new top-level re-exports for `defineTool`, `defineViewportTool`, `mods`, the `Result` constructors, and the `HitResult` types.

**Tech Stack:** TypeScript, React 18+, Vitest.

**Spec:** `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`.
**Predecessors:** Phase 1–5c plans (in the same directory).

---

## Pre-flight survey findings

Investigation completed before writing tasks. Documenting here so subagents don't repeat the grep work.

### Imperative `defineTool` is essentially orphaned

`src/tools/defineTool.ts` is a 19-line identity helper (`function defineTool<T>(spec): Tool<T> { return spec }`). No built-in tool imports it. Survey:

```bash
grep -rln "from '../defineTool'" /Users/mike/src/weasel/src/tools/builtin/
# → empty (verified per Phase 5c T4)
```

External consumers of `tools/defineTool` (not `tools/routing/defineTool`):

| File | Use |
|---|---|
| `src/canvas/Canvas.test.tsx:555` | Test fixture builds a stub tool with `drag.onStart`/`onEnd` returning `'claim'`. |
| `src/tools/dispatcher.test.ts:4` | Test fixtures via `import { defineTool } from './defineTool';` for imperative-shape stubs. |
| `src/tools/integration.test.tsx:7` | Test fixtures. |
| `src/tools/useTools.test.ts:5` | Test fixtures. |
| `src/tools/useKeybindings.test.ts:6` | Test fixtures. |
| `src/tools/index.ts:1` | Public re-export. |

**Every non-test consumer is the barrel re-export itself.** Migration cost is: rewrite ~5 test files to build tools through the declarative factory, then delete the imperative file.

The test-fixture rewrites are mechanical — the imperative shape (`{ id, drag: { onStart, onEnd, ... }, pointer: { onClick }, ... }`) translates to `{ id, initial: { drag: () => begin({ scratch, onMove, onRelease }), click: { '*': fn } } }`. Several fixtures only need a `.id` and call no handlers; those can use `defineTool({ id, initial: {} })` directly.

### Builtin tools' import landscape (the moving target)

26 import lines across `src/tools/builtin/` pull from `'../routing'` or `'../routing/hitResult'`. Spread:

```
useEyedropperTool.ts        defineTool, claim, none, type ActionFn
useEyedropperTool.test.ts   type HitResult from '../routing/hitResult'
useStarTool.tsx             defineTool, begin, claim, none
useDuplicateTool.ts         defineTool, claim, none
usePolygonTool.tsx          defineTool, begin, claim, none
useLassoTool.ts             defineTool, claim, begin, none
useHandTool.ts              defineViewportTool, begin, hold, cancel
useKeyboardZoomTool.ts      defineViewportTool, claim, none, type Result
useEditAnchorsTool.ts       defineTool, begin, claim, none
useEditAnchorsTool.test.tsx type HitResult from '../routing/hitResult'
useEllipseTool.tsx          defineTool, begin, claim
useRectTool.ts              defineTool, begin, claim
usePencilTool.tsx           defineTool, begin, claim
useWheelZoomTool.ts         defineViewportTool, claim, none
useDeleteTool.ts            defineTool, claim
useWheelPanTool.ts          defineViewportTool, claim, none
useTextTool.test.ts         (none — fixture inline)
defineDragInsertTool.ts     defineTool, claim, begin
useSelectTool.ts            defineTool, mods, begin, claim, none, type ActionFn
useUserPenTool.ts           defineTool, begin, claim, none
useNudgeTool.ts             defineTool, claim
useLineTool.tsx             defineTool, begin, claim
useCloneTool.ts             defineTool, begin, claim, none, type ActionFn
useUndoRedoTool.ts          defineTool, claim, none
```

Plus 3 other internal sites importing factory primitives from `'../../../tools/routing'`:

```
src/interactions/gestures/move/move.ts        begin, hold, cancel, type Result
src/interactions/gestures/move/move.test.ts   type BeginSpec
src/interactions/gestures/area-select/areaSelect.ts        begin, hold, cancel, type Result
src/interactions/gestures/area-select/areaSelect.test.ts   type Result
```

Plus 3 sites importing the deep paths directly:

```
src/tools/dispatcher.ts        type HitResult from './routing/hitResult'
                               type RouteResolvedInfo from './routing/reflection/route-resolved'
src/tools/types.ts             type HitResult from './routing/hitResult'
src/tools/dispatcher.test.ts   defineTool from './routing/defineTool'
                               apply from './routing/result'
```

**Rough internal import-rewrite count: ~30 lines** across ~30 files. The bulk is a single `'../routing'` → `'../'` (or absolute `'tools/'`) rewrite per builtin tool; mechanical.

### Subpath `@orochi235/weasel/routing` — single external consumer

```bash
grep -rn "from '@orochi235/weasel/routing'" /Users/mike/src/weasel/ 2>/dev/null
# demo/demos/ToolReflectionDemo.tsx:20 — buildActionRegistry, findConflicts, apply, mods,
#                                        type RegistryEntry, type Conflict, type ToolDef
```

Plan files reference it as illustrative code samples; no other live consumer.

`apps/swillustrator/` and `packages/weasel-*` do **not** import `defineTool` (declarative or imperative), `ToolDef`, or the `/routing` subpath at all. Swillustrator builds tools by composing the kit's built-in `useSelectTool`, `useHandTool`, etc., never authoring its own through either factory. Confirmed via:

```bash
grep -rln "defineTool\|/routing\|tools/routing" /Users/mike/src/weasel/apps/swillustrator/ /Users/mike/src/weasel/packages/
# → empty
```

The `ToolReflectionDemo` is the *only* current `/routing` consumer. The subpath must keep working (the demo is on the published surface for the docs site), but its surface area shrinks: `apply`/`mods`/`ToolDef` move to the main barrel; only reflection-flavored exports (`buildActionRegistry`, `findConflicts`, `RegistryEntry`, `Conflict`, `RouteResolvedInfo`, `RoutePhase`, `RouteGesture`, `formatRouteResolved`, `useToolDebugInfo`, `ToolDebugOverlay`) stay on `/routing`.

### Test-coverage delta (imperative vs. declarative)

| File | Lines | Scope |
|---|---|---|
| `src/tools/defineTool.test.ts` (imperative) | **53** | Three behaviors: returns-spec-unchanged identity, infers `TScratch` from `initScratch`, defaults `TScratch` to `undefined`. Plus one `overlay` round-trip. |
| `src/tools/routing/defineTool.test.ts` (declarative) | **368** | All Phase 1–4.5 factory behaviors: phase-free click, `begin`/`hold`/`commit`/`cancel` lifecycle, engaged-phase routing, cursor phase override, `claim`, overlay forwarding, function-form `claimsAll`, `initScratch` forwarding, `pointerDown` (Phase 4.5), raw-event parameter (Phase 4.5). |

The imperative test file is **53 lines, not 4000+** — the prompt's "4000+ lines" estimate is incorrect. The 53 lines exclusively cover:

1. Identity (`tool === spec`) — irrelevant after deletion (the declarative factory does *not* return the spec unchanged; it builds a new `Tool<TScratch>` object).
2. `TScratch` inference from `initScratch` — covered by the declarative `forwards def.initScratch onto Tool.initScratch` test (line 209).
3. `TScratch` defaults to `undefined` — partially covered. The declarative factory defaults `TScratch` to `void`, not `undefined`, and `initScratch` defaults to `() => null as unknown as TScratch`. **Coverage gap:** there is no current declarative test asserting `expectTypeOf(ctx.scratch).toEqualTypeOf<undefined>()` when no `initScratch` is supplied. Document as a small additive test in T2, not a blocker.
4. `overlay` round-trip — covered by the declarative `forwards initial.overlay onto Tool.overlay` (line 160) and `omits Tool.overlay when no phase.overlay` (line 174). Note the contract differs (imperative: top-level `overlay`; declarative: `initial.overlay: () => RenderLayer`); the declarative tests already exercise both code paths.

**Net coverage gap: one optional type-only test for the no-scratch `void` default.** No behavioral coverage is lost.

### Naming hygiene survey ("routing" words to rename)

`grep -n routing src/tools/dispatcher.ts` returns 5 hits, all JSDoc / inline comments. They use "routing" as a description ("routing factories", "declarative routing tables") rather than naming the subpath, and they remain correct after the factory moves up one level — declarative routing is still the factory's job; it just doesn't live in a folder called `routing/` anymore. **Decision:** leave these comments alone. The phrase "declarative routing" stays accurate; renaming to "the factory" would lose information ("which factory? the kit has many"). Documented in T7's spec-update task.

### Why hard-remove rather than `@deprecated`

The kit ships at `0.3.0`. No version stability has been promised. Soft deprecation costs two ways:

1. **Cognitive load on tool authors.** Two `defineTool` identifiers visible in autocomplete is the worst case — authors must read JSDoc to pick the right one. Even with `@deprecated` annotations, the imperative version remains accessible.
2. **Test surface duplication.** The imperative file plus its 53-line test stay in CI forever.

Soft deprecation only earns its keep when there are *external consumers depending on the old API*. The grep results above confirm there are none outside `src/`. Hard remove.

### Why move the declarative factory to `src/tools/defineTool.ts` (canonical location)

Two paths considered:

1. **Leave the declarative factory at `src/tools/routing/defineTool.ts`.** Re-export it from `src/tools/defineTool.ts`. Cheaper diff, but it leaves `defineTool` living in a folder named after one of its concerns (routing) rather than at the top of the tool subsystem. The folder name then misleads — `routing/` would house the *primary* tool authoring surface alongside reflection consumers.
2. **Move it up.** `src/tools/defineTool.ts` becomes the canonical location, matching every other top-level tool primitive (`useTools.ts`, `dispatcher.ts`, `useKeybindings.ts`). The `routing/` folder narrows to its real purpose: **introspection** of routed tools (registry, conflict-walking, debug overlay).

Picked option 2. Rationale:

- The factory *is* the public API. It deserves a top-level path.
- `routing/` becomes a meaningful, narrow surface: "things that introspect routed tools." A new consumer scanning the directory tree sees `defineTool.ts`, `useTools.ts`, `dispatcher.ts` at the top — the authoring surface — and `routing/reflection/` underneath — the introspection surface. Folder name matches contents.
- Internal imports shorten: built-in tools at `src/tools/builtin/` go from `import ... from '../routing'` to `import ... from '..'`, which is the standard `import { Tool } from '../types'` pattern siblings already use.

---

## Task ordering rationale

The dependency graph dictates order: the factory file move must precede the substrate moves (otherwise `defineTool.ts` imports broken paths intermediately). Test-fixture rewrites of the imperative `defineTool` callers must happen *before* its deletion (otherwise tests fail between commits). Barrel/spec updates come last.

1. **T1 — Audit imperative `defineTool` consumers + rewrite test fixtures.** Convert the 5 test files (`Canvas.test.tsx`, `dispatcher.test.ts`, `integration.test.tsx`, `useTools.test.ts`, `useKeybindings.test.ts`) to build their stub tools via the declarative factory. Keep imperative file alive; tests stay green throughout.
2. **T2 — Move `routing/defineTool.{ts,test.ts}` → `tools/defineTool.{ts,test.ts}`** (overwriting the imperative files). Add one type-only test for the no-`initScratch` `void` default to close the coverage gap. Update internal imports throughout the kit (~26 builtin sites + 3 deep-path sites).
3. **T3 — Move `routing/{result,modifiers,lookup,hitResult,types,defineViewportTool}.ts` → `src/tools/`.** Update the ~30 import sites identified in pre-flight (builtin tools + interactions/gestures + dispatcher + types).
4. **T4 — Update `src/tools/routing/index.ts`.** Reduce to reflection-only re-exports. Keep `RegistryEntry`, `Conflict`, `RouteResolvedInfo`, `RoutePhase`, `RouteGesture`, `formatRouteResolved`, `useToolDebugInfo`, `ToolDebugOverlay`, `buildActionRegistry`, `findConflicts`. Drop `defineTool`, `defineViewportTool`, `mods`, the `Result` constructors, the `HitResult` types — they now live at the kit root.
5. **T5 — Update main barrel `src/index.ts`.** Promote the factory + supporting authoring exports out of the `routing` namespace and onto the top-level. Adjust the `ToolReflectionDemo` to import `apply`, `mods`, and `type ToolDef` from `@orochi235/weasel` directly while keeping `buildActionRegistry`, `findConflicts`, `RegistryEntry`, `Conflict` from `@orochi235/weasel/routing`.
6. **T6 — Update spec doc.** Add a "Phase 6 follow-up" section after the existing Phase 4.5 follow-up: imperative removed, canonical location is `src/tools/defineTool.ts`, `/routing` subpath houses reflection. Note no API behavioral change.
7. **T7 — Full regression sweep.** `prepublishOnly`, kit tests, Swillustrator typecheck, demo build.

---

## T1 — Convert imperative-`defineTool` test fixtures to declarative

### Goal

Rewrite the 5 test files (and one production-test fixture in `Canvas.test.tsx`) that import the imperative `defineTool` so they construct their stub tools via the declarative factory at `src/tools/routing/defineTool.ts`. After this task the imperative `defineTool.ts` is unused by anything except `src/tools/index.ts`'s barrel re-export.

### Steps

- [ ] **Verify the consumer list.** Run:

  ```bash
  grep -rn "tools/defineTool'\|from './defineTool'" /Users/mike/src/weasel/src/ 2>/dev/null | grep -v "/routing/"
  ```

  Expected output (8 lines, exactly):

  ```
  src/canvas/Canvas.test.tsx:555:import { defineTool } from 'tools/defineTool';
  src/tools/defineTool.test.ts:3:import { defineTool } from './defineTool';
  src/tools/dispatcher.test.ts:4:import { defineTool } from './defineTool';
  src/tools/index.ts:1:export { defineTool } from './defineTool';
  src/tools/integration.test.tsx:7:import { defineTool } from './defineTool';
  src/tools/useKeybindings.test.ts:6:import { defineTool } from './defineTool';
  src/tools/useTools.test.ts:5:import { defineTool } from './defineTool';
  ```

  If anything else appears, surface it and quarantine before continuing. The `defineTool.test.ts` line is the imperative test file itself; it gets deleted in T2.

- [ ] **`src/canvas/Canvas.test.tsx`** — single test fixture at line 555. Replace:

  ```ts
  import { defineTool } from 'tools/defineTool';
  // ...
  t: defineTool({
    id: 't',
    drag: { onStart: onDragStart, onEnd: onDragEnd },
  }),
  ```

  with:

  ```ts
  import { defineTool } from 'tools/routing/defineTool';
  import { begin, claim } from 'tools/routing/result';
  // ...
  t: defineTool({
    id: 't',
    initial: {
      drag: () => {
        onDragStart();
        return begin({
          scratch: null,
          onRelease: () => { onDragEnd(); return claim(); },
        });
      },
    },
  }),
  ```

  Note the assertion targets (`expect(onDragStart).toHaveBeenCalled()`, etc.) stay valid because the spies still fire from inside the route action; the dispatcher decisions are unchanged (`begin` → `'claim'`, `claim()` → `'claim'`).

- [ ] **`src/tools/dispatcher.test.ts`** — convert every imperative fixture. The file currently imports two `defineTool`s side-by-side:

  ```ts
  import { defineTool } from './defineTool';
  import { defineTool as defineDeclarativeTool } from './routing/defineTool';
  import { apply } from './routing/result';
  ```

  Drop the imperative `defineTool` import. Replace every imperative-shape fixture (`defineTool({ id, drag: { onStart, ... }, pointer: { onClick, ... }, keyboard: { onDown }, wheel: { onWheel } })`) with the declarative equivalent. Pattern map (apply to each occurrence):

  | Imperative | Declarative |
  |---|---|
  | `{ pointer: { onClick: fn } }` | `{ initial: { click: { '*': (_ctx, e) => { const d = fn(e, _ctx); return d === 'claim' ? claim() : none(); } } } }` |
  | `{ drag: { onStart, onMove, onEnd } }` | `{ initial: { drag: () => begin({ scratch: null, onMove, onRelease: onEnd }) } }` (where `onStart` ran a side effect — fold it into the route action before the `begin`) |
  | `{ keyboard: { onDown: fn } }` | `{ initial: { keyDown: { [key]: (_ctx, e) => …rewrap to Result… } } }` |
  | `{ wheel: { onWheel } }` | `{ initial: { wheel: (_ctx, e) => …Result wrap… } }` |

  Use the unified `defineTool` from `./routing/defineTool` (drop the `defineDeclarativeTool` alias — the imperative shadow is gone). Use `claim()`, `none()`, `apply([...])` from `./routing/result`.

  Run after each chunk of conversions:

  ```bash
  cd /Users/mike/src/weasel && npx vitest run src/tools/dispatcher.test.ts
  ```

  Expected: all tests still pass. The dispatcher decisions (`'claim'` / `'pass'`) are invariants; only the tool-authoring shape changed.

- [ ] **`src/tools/integration.test.tsx`** — same imperative-to-declarative rewrite pattern. Run:

  ```bash
  cd /Users/mike/src/weasel && npx vitest run src/tools/integration.test.tsx
  ```

  Expected: green.

- [ ] **`src/tools/useTools.test.ts`** — same. Several fixtures only need `defineTool({ id })`; under the declarative shape that becomes `defineTool({ id, initial: {} })`. The `initial: {}` is mandatory per `ToolDef.initial: PhaseDef<TScratch>`.

  ```bash
  cd /Users/mike/src/weasel && npx vitest run src/tools/useTools.test.ts
  ```

- [ ] **`src/tools/useKeybindings.test.ts`** — same pattern. The `keybinding` field carries through both factories identically (`def.keybinding` is forwarded onto `Tool.keybinding` in `routing/defineTool.ts` line 246), so no behavioral translation is needed for the keybinding lookup; only the surrounding fixture shape changes.

  ```bash
  cd /Users/mike/src/weasel && npx vitest run src/tools/useKeybindings.test.ts
  ```

- [ ] **Final verification** before this task closes. Confirm the imperative `defineTool` now has exactly one importer (the barrel):

  ```bash
  grep -rn "tools/defineTool'\|from './defineTool'" /Users/mike/src/weasel/src/ 2>/dev/null | grep -v "/routing/" | grep -v defineTool.test.ts
  ```

  Expected output: **two lines** — `src/tools/index.ts:1` (the barrel re-export) and the file `defineTool.ts` itself doesn't have its own reverse imports. T2 removes both.

- [ ] **Commit:** `refactor(tools): rewrite imperative-defineTool test fixtures via declarative factory`. No production code changes. Tests green.

---

## T2 — Move `routing/defineTool.{ts,test.ts}` → canonical `src/tools/defineTool.{ts,test.ts}`

### Goal

Replace the imperative `src/tools/defineTool.ts` with the declarative factory file currently at `src/tools/routing/defineTool.ts`. Promote `defineTool` (the declarative one) to the canonical top-of-`tools/` location. Backfill one type-only test for the `void` default coverage gap.

### Steps

- [ ] **Delete the imperative files** (`git rm`):

  ```bash
  cd /Users/mike/src/weasel && git rm src/tools/defineTool.ts src/tools/defineTool.test.ts
  ```

- [ ] **`git mv` the declarative factory and its test up one level:**

  ```bash
  cd /Users/mike/src/weasel && \
    git mv src/tools/routing/defineTool.ts      src/tools/defineTool.ts && \
    git mv src/tools/routing/defineTool.test.ts src/tools/defineTool.test.ts
  ```

- [ ] **Fix the moved files' relative imports.** `src/tools/defineTool.ts` previously imported from `'../types'` (now `'./types'`) and from siblings inside the routing folder (`'./types'`, `'./result'`, `'./lookup'`, `'./modifiers'`, `'./reflection/route-resolved'`).

  - `import type { Tool, ToolCtx, ToolModifiers } from '../types';` → `from './types';`
  - `import type { ToolDef, PhaseDef, ActionFn } from './types';` → **keep as-is for now**. Phase T3 moves the typing module up; this task leaves it sitting in `routing/types.ts` for a brief intermediate. To keep the move atomic, change to: `import type { ToolDef, PhaseDef, ActionFn } from './routing/types';`
  - `import type { Result, BeginSpec } from './result';` → `from './routing/result';`
  - `import { resolveRoute } from './lookup';` → `from './routing/lookup';`
  - `import { mods, type ModifierKey } from './modifiers';` → `from './routing/modifiers';`
  - `import type { RouteResolvedInfo, RoutePhase, RouteGesture } from './reflection/route-resolved';` → `from './routing/reflection/route-resolved';`

  The substrate moves to `src/tools/` in T3; these `./routing/...` paths get tightened then.

- [ ] **Fix `src/tools/defineTool.test.ts`'s relative imports** (formerly inside `routing/`, now in `tools/`):

  - `import { defineTool } from './defineTool';` — unchanged path.
  - `import { apply, begin, hold, commit, cancel, claim } from './result';` → `from './routing/result';`
  - `import { asNodeId } from '../../core/scene/types';` → `from '../core/scene/types';`
  - `import type { Op } from '../../core/ops/types';` → `from '../core/ops/types';`
  - `import type { RenderLayer } from '../../core/layers/render';` → `from '../core/layers/render';`

- [ ] **Backfill the coverage gap.** Append one type-only test to `src/tools/defineTool.test.ts`:

  ```ts
  it('defaults TScratch via void; initScratch yields null when omitted', () => {
    // The declarative factory defaults TScratch to void; initScratch
    // defaults to `() => null as unknown as TScratch` (see defineTool.ts).
    // Pin the runtime + type behavior so a future tightening of the
    // generic default surfaces here.
    const tool = defineTool({ id: 'no-scratch', initial: {} });
    expect(tool.initScratch!()).toBeNull();
    expectTypeOf(tool.initScratch!()).toEqualTypeOf<void>();
  });
  ```

  Update the test file's top-level `vitest` import to include `expectTypeOf` if not already there.

- [ ] **Update internal imports across the kit.** The 26 builtin imports + 3 interactions/gestures imports currently read `'../routing'` or `'../../../tools/routing'`. After T2 + T3, all of those resolve through the `tools` barrel; for now (post-T2, pre-T3) they remain valid because the `routing/index.ts` re-export is still in place. **No builtin tool edits in T2** — they all import from `'../routing'`, not from `'../routing/defineTool'` directly. Confirm with:

  ```bash
  grep -rn "from '\.\./routing/defineTool'" /Users/mike/src/weasel/src/tools/builtin/
  ```

  Expected: empty.

- [ ] **Update the one site that imports from the deep path:**

  - `src/tools/dispatcher.test.ts:5` — `import { defineTool as defineDeclarativeTool } from './routing/defineTool';` → after T1 the alias is gone; if any remaining usage exists, fix to `from './defineTool';`. Grep to confirm:

    ```bash
    grep -n "routing/defineTool" /Users/mike/src/weasel/src/
    ```

    Expected: empty after T1's cleanup. If anything appears, fix here.

- [ ] **Update the `routing/index.ts` re-export.** Change line 13 from:

  ```ts
  export { defineTool } from './defineTool';
  ```

  to:

  ```ts
  export { defineTool } from '../defineTool';
  ```

  This keeps the `@orochi235/weasel/routing` subpath surface unchanged for ToolReflectionDemo and other current consumers; T4 narrows it further.

- [ ] **Update the `routing/defineViewportTool.ts`** import chain:

  ```ts
  import { defineTool } from './defineTool';
  ```

  → `import { defineTool } from '../defineTool';` (until T3 moves `defineViewportTool` up too).

- [ ] **Update `src/tools/index.ts`** barrel. The line `export { defineTool } from './defineTool';` now points at the declarative factory — the surface change is transparent. Add a note comment:

  ```ts
  // Declarative tool authoring factory. The imperative identity-helper
  // variant was removed in Phase 6 (2026-05-12); declarative is the
  // single supported authoring path.
  export { defineTool } from './defineTool';
  ```

- [ ] **Run the typecheck + full test suite.** This task touches the most critical surface:

  ```bash
  cd /Users/mike/src/weasel && npm run typecheck && npm test
  ```

  Expected: clean. If `tsc --noEmit` flags anything in `src/tools/routing/` or a builtin tool, it means the brief intermediate `./routing/...` paths in the moved factory file are wrong; correct against the actual sibling layout in `routing/`.

- [ ] **Commit:** `refactor(tools): hoist declarative defineTool to canonical src/tools/defineTool.ts`. The diff is: imperative deleted; declarative + its test moved up; brief intermediate `./routing/...` paths inside the moved files; barrel and routing index updated to bridge.

---

## T3 — Hoist factory substrate (`result`, `lookup`, `modifiers`, `hitResult`, `types`, `defineViewportTool`)

### Goal

Move the rest of the factory's support files up one level so the canonical layout is:

```
src/tools/
├── defineTool.ts          ← Phase 6 T2
├── defineTool.test.ts     ← Phase 6 T2
├── defineViewportTool.ts  ← this task
├── result.ts              ← this task
├── result.test.ts         ← this task
├── lookup.ts              ← this task
├── lookup.test.ts         ← this task
├── modifiers.ts           ← this task
├── modifiers.test.ts      ← this task
├── hitResult.ts           ← this task
├── hitResult.test.ts      ← this task
├── routeTypes.ts          ← this task (renamed from routing/types.ts to disambiguate from tools/types.ts)
├── defineViewportTool.test.ts  ← this task
├── types.ts               (unchanged — the Tool / ToolCtx / etc. types)
├── dispatcher.ts          (unchanged location; imports updated)
├── useTools.ts            (unchanged)
├── useKeybindings.ts      (unchanged)
└── routing/
    └── reflection/        ← unchanged; surface narrows in T4
        ├── registry.ts
        ├── conflicts.ts
        ├── route-resolved.ts
        ├── useToolDebugInfo.ts
        └── ToolDebugOverlay.tsx
```

Note on `types.ts` collision: the routing folder's `types.ts` (which holds `ToolDef`, `PhaseDef`, `RouteTable`, `ActionFn`, `ViewportToolDef`, `ViewportPhaseDef`) and the existing `src/tools/types.ts` (which holds `Tool`, `ToolCtx`, `ToolModifiers`, `Decision`, etc.) cannot share a filename. **Rename `routing/types.ts` to `src/tools/routeTypes.ts`** on the way up. The contents are all route-table authoring types; the name reads correctly. Document the rename in T6's spec update.

### Steps

- [ ] **`git mv` the six files (and tests) up:**

  ```bash
  cd /Users/mike/src/weasel && \
    git mv src/tools/routing/result.ts      src/tools/result.ts && \
    git mv src/tools/routing/result.test.ts src/tools/result.test.ts && \
    git mv src/tools/routing/lookup.ts      src/tools/lookup.ts && \
    git mv src/tools/routing/lookup.test.ts src/tools/lookup.test.ts && \
    git mv src/tools/routing/modifiers.ts   src/tools/modifiers.ts && \
    git mv src/tools/routing/modifiers.test.ts src/tools/modifiers.test.ts && \
    git mv src/tools/routing/hitResult.ts   src/tools/hitResult.ts && \
    git mv src/tools/routing/hitResult.test.ts src/tools/hitResult.test.ts && \
    git mv src/tools/routing/types.ts       src/tools/routeTypes.ts && \
    git mv src/tools/routing/defineViewportTool.ts      src/tools/defineViewportTool.ts && \
    git mv src/tools/routing/defineViewportTool.test.ts src/tools/defineViewportTool.test.ts
  ```

- [ ] **Fix the moved files' relative imports.** Each moved file currently has paths like `'../types'` and `'../../core/...'`. After the move, those resolve from `src/tools/`:

  - `result.ts`: `'../../core/ops/types'` → `'../core/ops/types'`; `'../types'` → `'./types'`.
  - `lookup.ts`: `'./types'` (now refers to `tools/types.ts` — wrong!) → `'./routeTypes'`; `'./hitResult'` → unchanged path, valid; `'../types'` → `'./types'`; `'./modifiers'` → unchanged path, valid.
  - `modifiers.ts`: no relative imports.
  - `hitResult.ts`: `'../../core/scene/types'` → `'../core/scene/types'`.
  - `routeTypes.ts` (formerly `routing/types.ts`): `'../types'` → `'./types'`; `'../../interactions/...'` → `'../interactions/...'`; `'../../core/layers/render'` → `'../core/layers/render'`; `'./result'` → unchanged path, valid; `'./modifiers'` → unchanged path, valid.
  - `defineViewportTool.ts`: `'../types'` → `'./types'`; `'./types'` (routing/types) → `'./routeTypes'`; `'./defineTool'` → unchanged path, valid.

- [ ] **Fix `src/tools/defineTool.ts`'s temporary `./routing/...` paths from T2.** Now that the substrate has moved up:

  - `from './routing/types'` → `from './routeTypes'`
  - `from './routing/result'` → `from './result'`
  - `from './routing/lookup'` → `from './lookup'`
  - `from './routing/modifiers'` → `from './modifiers'`
  - `from './routing/reflection/route-resolved'` → `from './routing/reflection/route-resolved'` (unchanged; reflection stays put)

- [ ] **Fix `src/tools/defineTool.test.ts`'s `./routing/result` path from T2:** → `from './result'`.

- [ ] **Update all builtin imports** from `'../routing'` to `'..'`. Sites (26 lines from pre-flight):

  ```bash
  cd /Users/mike/src/weasel && \
    grep -rl "from '\.\./routing'" src/tools/builtin/ | \
    xargs sed -i '' "s|from '\.\./routing'|from '..'|g"
  ```

  Then fix the lone `'../routing/hitResult'` references (two test files):

  ```bash
  cd /Users/mike/src/weasel && \
    grep -rl "from '\.\./routing/hitResult'" src/tools/builtin/ | \
    xargs sed -i '' "s|from '\.\./routing/hitResult'|from '../hitResult'|g"
  ```

  These two `sed` invocations are the bulk of the import topology rewrite. Verify after:

  ```bash
  grep -rn "from '\.\./routing" /Users/mike/src/weasel/src/tools/builtin/
  ```

  Expected: empty.

- [ ] **Update the three `interactions/gestures` sites** (deep imports of `tools/routing` from outside the tools subsystem):

  - `src/interactions/gestures/move/move.ts:9` — `import { begin, hold, cancel as cancelResult, type Result } from '../../../tools/routing';` → `from '../../../tools';`
  - `src/interactions/gestures/move/move.test.ts:8` — `import type { BeginSpec } from '../../../tools/routing';` → `from '../../../tools';` (but `BeginSpec` will need to be re-exported from `tools/index.ts` — see next step).
  - `src/interactions/gestures/area-select/areaSelect.ts:13` — same rewrite as move.ts.
  - `src/interactions/gestures/area-select/areaSelect.test.ts:140` — `import type { Result } from '../../../tools/routing';` → `from '../../../tools';`.

- [ ] **Add the substrate exports to `src/tools/index.ts`.** The barrel currently re-exports `defineTool`, `useTools`, dispatcher, types — extend with the substrate so the `interactions/gestures` consumers (and external authors) can import from `'..'`:

  ```ts
  export { defineTool } from './defineTool';
  export { defineViewportTool } from './defineViewportTool';
  export {
    apply, begin, hold, commit, cancel, claim, none,
  } from './result';
  export type { Result, BeginSpec } from './result';
  export { mods } from './modifiers';
  export type { ModifierKey } from './modifiers';
  export { resolveRoute } from './lookup';
  export type {
    HitResult, EmptyHit, NodeHit, AffordanceHit, NodeRef, NodeRefHit,
  } from './hitResult';
  export type {
    ToolDef, PhaseDef, RouteTable, RouteEntry, ModifierRoute, ActionFn,
    ViewportToolDef, ViewportPhaseDef,
  } from './routeTypes';
  export { useTools } from './useTools';
  export type { UseToolsOptions, ToolsApi } from './useTools';
  export { useKeybindings } from './useKeybindings';
  export type { UseKeybindingsOptions } from './useKeybindings';
  export { createToolsDispatcher } from './dispatcher';
  export type { ToolsDispatcher } from './dispatcher';
  export type {
    Tool, AnyTool, ToolCtx, ToolModifiers, ToolSlot, Decision,
    HotkeyTrigger,
    PointerChannel, DragChannel, KeyboardChannel, WheelChannel,
  } from './types';
  export * from './builtin';
  ```

- [ ] **Update `src/tools/dispatcher.ts` and `src/tools/types.ts`** deep imports of `routing/hitResult`:

  - `src/tools/dispatcher.ts:7` — `import type { HitResult } from './routing/hitResult';` → `from './hitResult';`
  - `src/tools/types.ts:8` — `import type { HitResult } from './routing/hitResult';` → `from './hitResult';`
  - `src/tools/dispatcher.ts:8` — `import type { RouteResolvedInfo } from './routing/reflection/route-resolved';` — **leave unchanged**; reflection consumers stay in `routing/reflection/`.

- [ ] **Update `src/tools/routing/index.ts`** to re-export from the parent for the substrate. (T4 narrows this further; this step keeps the surface unbroken intermediate.)

  Change every `from './result'`, `from './lookup'`, `from './modifiers'`, `from './hitResult'`, `from './types'`, `from './defineTool'`, `from './defineViewportTool'` to `from '..'` (the tools barrel re-exports all of them):

  ```ts
  // src/tools/routing/index.ts — intermediate after T3, narrowed in T4
  export type {
    HitResult, EmptyHit, NodeHit, AffordanceHit, NodeRef, NodeRefHit,
    Result, BeginSpec, ModifierKey,
    ToolDef, PhaseDef, RouteTable, RouteEntry, ModifierRoute, ActionFn,
    ViewportToolDef, ViewportPhaseDef,
  } from '..';
  export {
    apply, begin, hold, commit, cancel, claim, none,
    mods, resolveRoute,
    defineTool, defineViewportTool,
  } from '..';
  // Reflection consumers stay local.
  export * from './reflection';
  ```

- [ ] **Update `src/tools/routing/reflection/*` internal imports.** Any reflection file that imports from `'../types'` (routing's old types module) or `'../hitResult'` now needs adjustment. Survey:

  ```bash
  grep -rn "from '\.\./types'\|from '\.\./hitResult'\|from '\.\./result'\|from '\.\./modifiers'" /Users/mike/src/weasel/src/tools/routing/reflection/
  ```

  For each match, repoint to `'../..'` (the tools barrel) or to `'../../routeTypes'` / `'../../hitResult'` etc. directly if a single-symbol import is preferred.

- [ ] **Run `npm run typecheck && npm test`.** This is the riskiest task — import topology has shifted across ~30 files. Expected: clean.

  If `tsc` flags a missing export, the most likely cause is the rename of `routing/types.ts` → `routeTypes.ts`: anywhere that previously imported `from '../routing/types'` directly needs to be `from '../routeTypes'`. Grep `routing/types` to find stragglers:

  ```bash
  grep -rn "routing/types" /Users/mike/src/weasel/src/
  ```

- [ ] **Commit:** `refactor(tools): hoist routing substrate (result/lookup/modifiers/hitResult/routeTypes/defineViewportTool) to src/tools/`.

---

## T4 — Narrow `src/tools/routing/index.ts` to reflection-only

### Goal

After T3 the `/routing` barrel re-exports authoring substrate from `'..'` purely to bridge intermediate. In T4 the barrel collapses to its real purpose: **reflection consumers**. External consumers of `@orochi235/weasel/routing` that need authoring primitives (`apply`, `mods`, `ToolDef`) get them from the main barrel `@orochi235/weasel` after T5.

### Steps

- [ ] **Edit `src/tools/routing/index.ts`** to its narrowed form:

  ```ts
  // src/tools/routing — reflection surface for declarative tool routing.
  //
  // The factory (`defineTool`, `defineViewportTool`), the action
  // constructors (`apply`, `begin`, `hold`, `commit`, `cancel`, `claim`,
  // `none`), `mods`, and the route-authoring types (`ToolDef`,
  // `PhaseDef`, `RouteTable`, ...) live at the top of the tools barrel
  // since Phase 6. Import them from `@orochi235/weasel`.
  //
  // This subpath houses introspection-only utilities — registry,
  // conflict-walking, debug overlay, route-resolved info.
  export * from './reflection';
  ```

  Everything else moves out. The `RouteResolvedInfo`/`RoutePhase`/`RouteGesture` types and the `formatRouteResolved`/`buildActionRegistry`/`findConflicts`/`useToolDebugInfo`/`ToolDebugOverlay` symbols are re-exported by `./reflection/index.ts` already (verified at `src/tools/routing/reflection/index.ts`).

- [ ] **Verify the demo still typechecks.** `demo/demos/ToolReflectionDemo.tsx` imports:

  ```ts
  import {
    buildActionRegistry,
    findConflicts,
    apply,
    mods,
    type RegistryEntry,
    type Conflict,
    type ToolDef,
  } from '@orochi235/weasel/routing';
  ```

  Of these, after the narrowing: `buildActionRegistry`, `findConflicts`, `RegistryEntry`, `Conflict` stay on `/routing`. `apply`, `mods`, `ToolDef` move to the main barrel. The demo must be updated in T5; for now T4 will leave `tsc` failing on those three symbols. Commit T4 + T5 as a pair, or stage the demo edit at the end of T4.

- [ ] **Stage the demo edit in this task.** Split `demo/demos/ToolReflectionDemo.tsx`'s import:

  ```ts
  import {
    apply, mods, type ToolDef,
  } from '@orochi235/weasel';
  import {
    buildActionRegistry, findConflicts,
    type RegistryEntry, type Conflict,
  } from '@orochi235/weasel/routing';
  ```

- [ ] **Run typecheck:**

  ```bash
  cd /Users/mike/src/weasel && npm run typecheck
  ```

  Expected: clean. The main barrel still doesn't export `apply` / `mods` / `ToolDef` until T5 — but it inherits them via `export * from './tools';` (T3 added them to the tools barrel), so this typecheck should pass cleanly.

- [ ] **Commit:** `refactor(tools): narrow /routing subpath to reflection-only exports`.

---

## T5 — Promote authoring exports onto the main kit barrel

### Goal

Now that `src/tools/index.ts` exports the full authoring surface (T3), make the main kit barrel `src/index.ts` surface those exports under the top-level. The `export * as routing from './tools/routing';` line stays — it's the reflection namespace — but `defineTool`, `defineViewportTool`, `mods`, `apply` & friends, and the `HitResult`/`ToolDef` types become first-class kit exports.

### Steps

- [ ] **Audit current `src/index.ts` re-exports of `./tools`.** Today line 105 says:

  ```ts
  export * from './tools';
  ```

  That's already a broad re-export — it will pick up everything the `src/tools/index.ts` barrel exposes. After T3, that includes `defineTool`, `defineViewportTool`, `apply`, `begin`, `hold`, `commit`, `cancel`, `claim`, `none`, `mods`, `resolveRoute`, `BeginSpec`, `Result`, `ModifierKey`, `HitResult` etc., `ToolDef` etc.

  Verify by listing exports:

  ```bash
  cd /Users/mike/src/weasel && npm run build 2>&1 | tail -30
  ```

  Then inspect `dist/index.d.ts`:

  ```bash
  grep -E "^(export \{|export type \{).*(defineTool|apply|mods|begin|HitResult|ToolDef)" /Users/mike/src/weasel/dist/index.d.ts | head -20
  ```

  Expected: those symbols appear at the top-level type surface.

  If any are missing, the `src/tools/index.ts` re-export is the place to fix — adjust there, not in `src/index.ts`.

- [ ] **Update the legacy commented hint at `src/index.ts` line 107–109.** Currently:

  ```ts
  // New declarative routing surface — experimental.
  // import { defineTool } from '@orochi235/weasel/routing';
  export * as routing from './tools/routing';
  ```

  Replace with:

  ```ts
  // Declarative tool authoring is now part of the main barrel:
  //   import { defineTool, apply, mods, type ToolDef } from '@orochi235/weasel';
  // The `/routing` subpath houses reflection-only utilities — registry,
  // conflict checker, debug overlay, route-resolved info. See Phase 6
  // notes in docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md.
  export * as routing from './tools/routing';
  ```

- [ ] **Run the full build:**

  ```bash
  cd /Users/mike/src/weasel && npm run build
  ```

  Expected: `dist/index.js`, `dist/index.d.ts`, `dist/routing.js`, `dist/routing.d.ts` all emit cleanly.

- [ ] **Verify the subpath dist artifact.** `dist/routing.d.ts` should now declare only the reflection types/symbols. Inspect:

  ```bash
  head -50 /Users/mike/src/weasel/dist/routing.d.ts
  ```

  Expected: declarations for `RegistryEntry`, `Conflict`, `buildActionRegistry`, `findConflicts`, `RouteResolvedInfo`, `useToolDebugInfo`, `ToolDebugOverlay`, `formatRouteResolved`. No `defineTool`, no `apply`, no `mods`.

- [ ] **Commit:** `refactor(barrel): promote declarative tool exports to main barrel`.

---

## T6 — Spec doc Phase 6 follow-up section

### Goal

Document the refactor in the spec doc so future readers (and the next reviewer) understand the canonical-location promotion. No new behavior; this is purely a structural note.

### Steps

- [ ] **Open `docs/superpowers/specs/2026-05-12-declarative-tool-routing-design.md`** and append a new section after the existing "Phase 4.5 follow-up" block (which ends around line 1027):

  ```markdown
  ## Phase 6 follow-up: imperative `defineTool` removed; canonical location renamed (shipped 2026-05-12)

  Phase 6 retired the imperative `defineTool` identity helper and promoted
  the declarative factory to the canonical kit location.

  ### What moved

  | Before | After |
  |---|---|
  | `src/tools/defineTool.ts` (imperative identity helper) | **deleted** |
  | `src/tools/defineTool.test.ts` (imperative tests) | **deleted** |
  | `src/tools/routing/defineTool.ts` (declarative factory) | `src/tools/defineTool.ts` |
  | `src/tools/routing/defineTool.test.ts` | `src/tools/defineTool.test.ts` |
  | `src/tools/routing/defineViewportTool.ts` | `src/tools/defineViewportTool.ts` |
  | `src/tools/routing/result.ts` | `src/tools/result.ts` |
  | `src/tools/routing/lookup.ts` | `src/tools/lookup.ts` |
  | `src/tools/routing/modifiers.ts` | `src/tools/modifiers.ts` |
  | `src/tools/routing/hitResult.ts` | `src/tools/hitResult.ts` |
  | `src/tools/routing/types.ts` | `src/tools/routeTypes.ts` (renamed to disambiguate from `src/tools/types.ts` — the `Tool`/`ToolCtx` module) |
  | `src/tools/routing/reflection/*` | unchanged |

  ### Public surface change

  Before Phase 6:

  ```ts
  import { defineTool, apply, mods, type ToolDef } from '@orochi235/weasel/routing';
  ```

  After Phase 6:

  ```ts
  import { defineTool, apply, mods, type ToolDef } from '@orochi235/weasel';
  ```

  The `/routing` subpath is preserved, narrowed to reflection consumers:

  ```ts
  import {
    buildActionRegistry, findConflicts,
    type RegistryEntry, type Conflict,
    type RouteResolvedInfo, formatRouteResolved,
    useToolDebugInfo, ToolDebugOverlay,
  } from '@orochi235/weasel/routing';
  ```

  ### Rationale

  1. **Imperative `defineTool` is dead weight at 0.3.0.** It was a
     19-line identity helper exclusively used to give TypeScript a
     hook for `TScratch` inference. With the declarative factory
     covering every shape the kit's built-in tools need (and after
     Phase 5b/5c, every built-in tool migrated), the imperative path
     served only as a parallel authoring surface for external
     consumers. No external consumer existed (Swillustrator, `weasel-*`
     packages, demo apps all confirmed via grep). At pre-1.0,
     soft-deprecation costs more than hard removal.
  2. **`routing/` is for introspection, not authoring.** The folder
     name should match its contents. After the move, `routing/` houses
     reflection consumers (registry, conflicts, debug overlay) and
     nothing else. Authoring lives at the top of `src/tools/`
     alongside `useTools`, `dispatcher`, `useKeybindings` — the rest
     of the tool subsystem's surface.
  3. **The dispatcher's JSDoc still uses the phrase "declarative
     routing".** That phrase describes a *behavior* (the factory
     translates route tables to dispatcher channels at translation
     time), not a folder. The phrase stays accurate after the file move.

  ### Migration note for external consumers

  Anyone authoring tools via `@orochi235/weasel/routing` before Phase 6
  changes their import line and otherwise their code is unaffected.
  Behavior, types, and runtime contract are identical.
  ```

- [ ] **Commit:** `docs(spec): note Phase 6 imperative-defineTool removal + canonical-location rename`.

---

## T7 — Full regression sweep

### Goal

Confirm the kit, Swillustrator, the demo, and the published surface all still work after the move. After this passes, Phase 6 is shippable.

### Steps

- [ ] **`prepublishOnly` gate** (per `feedback_run_prepublish_before_push.md`):

  ```bash
  cd /Users/mike/src/weasel && npm run prepublishOnly
  ```

  Expected: `tsc --noEmit` clean, all vitest tests pass, `tsup build` produces `dist/` artifacts without errors.

- [ ] **Swillustrator typecheck + build.** Swillustrator doesn't directly import `defineTool` or `/routing`, but it consumes the main barrel transitively:

  ```bash
  cd /Users/mike/src/weasel && npm run build:swill
  ```

  Expected: bundles cleanly. If anything breaks here it's almost certainly because a builtin tool's internal import didn't get rewritten in T3 — re-survey:

  ```bash
  grep -rn "from '\.\./routing\|tools/routing'" /Users/mike/src/weasel/src/
  ```

  Expected: only `src/tools/routing/reflection/*` internal paths (those stay) and `src/index.ts:109` (`export * as routing from './tools/routing';` — that stays). Anything else is a missed rewrite.

- [ ] **Demo build.**

  ```bash
  cd /Users/mike/src/weasel && npm run build:demo
  ```

  Expected: the demo bundles, including `ToolReflectionDemo` with its split imports.

- [ ] **Final pre-1.0 sanity: confirm the imperative `defineTool` is fully gone.**

  ```bash
  test ! -e /Users/mike/src/weasel/src/tools/defineTool.ts && \
    echo "missing" || \
    file /Users/mike/src/weasel/src/tools/defineTool.ts
  ```

  Expected output:

  ```
  /Users/mike/src/weasel/src/tools/defineTool.ts: ASCII text
  ```

  (it should exist — but as the *declarative* factory, not the 19-line imperative identity helper). Verify the contents:

  ```bash
  head -5 /Users/mike/src/weasel/src/tools/defineTool.ts
  ```

  Expected first line: a comment like `// src/tools/defineTool.ts` followed by imports from `'./types'`, `'./routeTypes'`, `'./result'`, etc. — the declarative factory's signature.

- [ ] **(Optional) Commit a completion marker** — if the user wants a "Phase 6 done" milestone commit beyond the per-task commits:

  ```
  refactor(tools): phase 6 complete — imperative defineTool retired

  - Imperative defineTool identity helper removed (was unused by all
    built-in tools after Phase 5b/5c).
  - Declarative factory promoted to src/tools/defineTool.ts (canonical
    location).
  - Factory substrate (result, lookup, modifiers, hitResult, routeTypes,
    defineViewportTool) hoisted alongside.
  - /routing subpath narrowed to reflection consumers only (registry,
    conflicts, debug overlay, route-resolved info).
  - Public API: `import { defineTool, apply, mods } from '@orochi235/weasel';`
    replaces `import { ... } from '@orochi235/weasel/routing';` for
    authoring. The subpath remains for reflection.
  ```

  Otherwise skip — six per-task commits document the work.

---

## What Phase 6 explicitly does NOT cover

1. **Reflection consumers' folder name.** `src/tools/routing/reflection/` stays at that path. Renaming `routing/` to `introspection/` or similar is a separate cosmetic decision; the public subpath `@orochi235/weasel/routing` is a stable contract for the demo.
2. **Inlining the dispatcher's JSDoc references to "routing".** Five comment-level uses of "routing" remain in `src/tools/dispatcher.ts`. They describe a behavior (declarative routing as a translation discipline), not a folder; they read correctly after the move. Touching them is a no-op refactor.
3. **The `BeginSpec` thresholdPx field.** Documented in `result.ts` but never consumed by the factory or dispatcher. Removal is a separate cleanup; out of scope here.
4. **Kit version bump.** Phase 6 is a refactor; consumer-visible behavior is identical. No `0.3.0 → 0.4.0` bump is required, but if the user wants to surface the breaking import-path change to external authors via the changeset, that's a separate release-coordination task.

---

## Self-review checklist

- [x] **Coverage** — every file in the imperative tools/ tree is accounted for. The imperative `defineTool.ts` + `defineTool.test.ts` are deleted (T2). The declarative factory and its six substrate files (result, lookup, modifiers, hitResult, routeTypes, defineViewportTool) plus their tests are moved up one level (T2 + T3). Reflection consumers (`routing/reflection/*`) stay put. The `routing/index.ts` is narrowed (T4). The main barrel `src/index.ts` is updated (T5).
- [x] **Placeholder scan** — no TBD, no "implement later." Every step shows the actual code, paths, or grep output expectations.
- [x] **Import topology** — every renamed import is traced. Pre-flight grep results documented for: ~26 builtin tool sites, 3 interactions/gestures sites, 3 deep-routing sites in dispatcher/types/dispatcher.test, 6 imperative-defineTool test consumers, 1 external `/routing` consumer (the demo). The full rewrite reaches via two `sed` invocations in T3 plus ~12 hand-edits across T1, T2, T3, T4, T5.
- [x] **Test continuity** — declarative `defineTool.test.ts` (368 LOC) covers every behavioral path. The imperative file's 53 LOC are subsumed except for one type-only assertion (`TScratch` defaults to `undefined`/`void`), which T2 backfills as a small additive test. No behavioral coverage lost.
- [x] **Pre-1.0 rationale documented.** T6 records the hard-remove decision and the canonical-location rationale in the spec doc so future archaeology surfaces the why.
