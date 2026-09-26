# Contributions as the feature unit — arc 1 (engine) implementation plan

> **For agentic workers:** executed inline in the session that wrote it
> (gogogo). Steps use checkbox (`- [ ]`) syntax. Delete this file when the
> branch merges.

**Goal:** a feature made of views, layers, bindings, actions and deps installs
through `<SceneCanvas ambient>` in one step, and the minimap with linked
cursors is written as one such feature.

**Architecture:** routing's `Contribution` gains `deps`; core's
`SurfaceContribution` adds `views` and `attach`. Bindings take a `views`
filter, and the dispatcher learns which view an input landed in. The pointer
store becomes a subscribable store carrying that view id, and is published as
a dep so contributions reach it. The minimap is `features/minimap/`.

**Spec:** `docs/superpowers/specs/2026-09-25-labkit-stage-overview-design.md`, arc 1.

## Decisions this plan adds to the spec

| Question | Answer | Why |
|---|---|---|
| How does `attach` reach the pointer store? | `attach(api, deps)`: the second argument reads the surface's dep registry. The store is published as a new `pointer` dep. | `CanvasExtensionApi` is the primitive canvas's handle; the pointer store lives on `<SceneCanvas>`. A dep keeps one lookup path for everything a contribution reads. |
| Inside the minimap, the select tool's drag (active tier) outranks the minimap's (ambient tier). | A binding whose `views` names the routed view outranks every binding that doesn't, whatever their tiers. A stable partition after `matchSorted`. | Naming a view is the most specific thing a binding can say about where it applies. Without it every view-scoped binding loses to the active tool. |
| The detached `<MinimapCanvas>` has a root dispatcher whose view id is `null`. | The actions (`minimap.center`, `minimap.pan`) are exported on their own. The contribution binds them with `views: [id]`, and `<MinimapCanvas>` binds them unscoped on its own dispatcher. | One action implementation, two binding sites. |
| Crosshair on the main canvas when the pointer is over a detached minimap. | `createLinkedCursorContribution()`: the crosshair layer alone. The minimap contribution includes the same layer. | The main canvas has no minimap view to hang it on. |
| A press without a drag. | `pointerDown → minimap.center` (immediate), `drag → minimap.pan` (ongoing). | A drag starts past the 4px threshold. Today's minimap recenters on press. |
| Theme token for the crosshair. | `--wzl-accent`, read from the canvas element's computed style when the crosshair paints, with a fixed fallback. | Core does not depend on `@weasel-js/theme`. The canvas sits in the themed DOM. |

## File map

| File | Change |
|---|---|
| `packages/routing/src/contributions/types.ts` | `ContributionRouting.deps` |
| `packages/routing/src/contributions/merge.ts` | Generic over the entry type; throws on a duplicate dep name |
| `packages/routing/src/interactions/actions/invoker.ts` | `BindingOpts.views`, `InvocationCtx.view` |
| `packages/routing/src/eligibility/ruleCtx.ts` | `RuleCtx.view` |
| `packages/routing/src/interactions/dispatcher/dispatcher.ts` | `DispatcherContext.view`; view filter in `assembleScopedBindings`; view-scoped-first partition; `view` on invocation and rule contexts |
| `packages/routing/src/interactions/dispatcher/useGestureDispatcher.tsx` | `ctxNow()` carries the routed id |
| `packages/core/src/canvas/surfaceContribution.ts` (new) | `SurfaceContribution`, `mergeContributions` with the view-id check, `ContributionDeps` reader type |
| `packages/core/src/canvas/SceneCanvas/useContributionRoles.ts` (replaces `useToolActions.ts`) | Installs actions, deps and `attach` for every entry |
| `packages/core/src/canvas/SceneCanvas.tsx` | `ambient` accepts `SurfaceContribution`; renders entries' `views`; `rootView` and `pointer` deps |
| `packages/core/src/interactions/actions/depSchema.ts` | `rootView: ViewApi`, `pointer?: PointerStore` |
| `packages/core/src/features/pointer/PointerContext.tsx` | Store: `get/set/subscribe/getVersion`; `usePointerPosition()`; `viewId` |
| `packages/core/src/canvas/SceneCanvas/PointerProviderIfRoot.tsx` | Publishes `target.id` |
| `packages/core/src/canvas/useViewHelpers.ts`, `Canvas.tsx`, `CanvasView.tsx` | `viewId` on layer data |
| `packages/hud/src/react/useHud.ts`, `packages/hud/src/tool.ts` | `createHudContribution(hud, opts)` carries `attach` |
| `packages/core/src/features/minimap/` (new) | `createMinimapContribution`, `createLinkedCursorContribution`, actions, layers, README |
| `packages/core/src/canvas/MinimapCanvas.tsx` | Dispatcher + shared actions; publishes and draws the pointer |
| `apps/site/demos/MinimapDemo.tsx` | Both forms: in-surface contribution and detached |
| `docs/extending.md`, `docs/taxonomy.md`, `docs/TODO.md`, `features/viewports/README.md` | §1.5 |

## Tasks

### Task 1: routing — `deps`, `views`, view on contexts

- [ ] Test (`routing/src/contributions/merge.test.ts`): two bundles declaring the
  same dep name throw, naming the dep.
- [ ] Test (`routing/src/interactions/dispatcher/dispatcher.test.ts`, new
  `describe('view-scoped bindings')`):
  - a drag binding with `opts.views: ['mini']` does not fire when
    `ctx.view` is `null`, and fires when it is `'mini'`;
  - an ambient binding scoped to `'mini'` beats an active-tier binding for the
    same gesture when `ctx.view === 'mini'`;
  - the invoker's `InvocationCtx.view` is the routed id, and a rule reading
    `RuleCtx.view` sees it (spy on `getRuleCtx` result via an `eligible` rule
    predicate is not available — assert via `filterEligible` input instead:
    the dispatcher passes `{ ...ruleCtx, view }`).
- [ ] Implement: `deps?: { [K in DepName]?: () => DepSchema[K] }` on
  `ContributionRouting`; `views?: readonly (string | null)[]` on
  `BindingOpts`; `view?: string | null` on `InvocationCtx`, `RuleCtx` and
  `DispatcherContext`. `assembleScopedBindings` drops a binding whose `views`
  omits `ctx.view ?? null`. `preferViewScoped(matches, view)` stably moves
  bindings naming the view to the front, applied in `handleInput` and
  `resolveAll`. `buildInvocationCtx` sets `view` from a per-call variable set
  at the top of `handleInput`. `useGestureDispatcher`'s `ctxNow()` adds
  `view: routedId`, and `routedRuleCtx` spreads `view` into the answer.
- [ ] `npx vitest run --project=routing packages/routing/src/contributions packages/routing/src/interactions/dispatcher/dispatcher.test.ts`
- [ ] Commit.

### Task 2: core — pointer store with view id

- [ ] Test (`features/pointer/PointerContext.test.tsx`, new): `set` notifies
  subscribers once per change and not for an equal value; `getVersion` bumps;
  `usePointerPosition` re-renders on change.
- [ ] Extend `perViewRouting.test.tsx`: the pointer inside the panel reports
  `viewId: 'panel'`, outside it `null`.
- [ ] Implement the store (`get`, `set`, `subscribe`, `getVersion`,
  `getDropPoint`), drop `pointerRef`, update `PointerPublisher` and the
  clipboard test's two writes.
- [ ] Run the three affected test files; commit.

### Task 3: core — `SurfaceContribution`, install, `rootView`, `viewId`

- [ ] Test (`canvas/SceneCanvas.contributions.test.tsx`, new):
  - an ambient `SurfaceContribution` with `views`, `deps` and `attach`:
    after mount the view is registered, the dep resolves, `attach` ran once
    with the api; after re-rendering without it the view is gone, the dep is
    unregistered and the teardown ran;
  - `rootView` read from a view's deps overlay resolves to the root camera
    (the view's `view` dep is its own);
  - layer data carries `viewId: null` on the surface and the view id inside
    a view (a probe overlay layer records `data.viewId` per draw — assert
    through `viewportLayer`'s `data` thunk directly, since jsdom has no GL).
  - core `mergeContributions` throws on a duplicate view id.
- [ ] Implement `surfaceContribution.ts`; replace `useToolActions` with
  `useContributionRoles(tools, api)`; render
  `entries.flatMap(e => e.views ?? [])` as `<CanvasView>`s; publish
  `rootView` and `pointer` deps; add `viewId` to `CanvasHelpers` and the two
  data sites.
- [ ] Move the HUD onto `attach`: `createHudContribution(hud, options)`
  returns the input entry plus `attach: (api) => attachHud(api, hud, options)`;
  `useHud` keeps its current signature for ref-driven callers, and
  `useHudContribution(hud, options)` is the one-step form. Update HUD tests
  and demos that call it.
- [ ] Run the new test, `SceneCanvas.view*.test.tsx`, `perViewRouting`,
  `CanvasView.test.tsx`, `packages/hud`; commit.

### Task 4: the minimap contribution

- [ ] Test (`features/minimap/minimap.test.tsx`):
  - pointerdown then a drag inside the minimap rect moves the root camera so
    the pressed world point is centered, and leaves the minimap camera alone;
  - a drag on the root outside the rect pans the root through `viewport.dragPan`
    as before (hand tool active) or marquees (select), unaffected;
  - the indicator layer paints only when `data.viewId === id` and its rect is
    the root's visible world rect; the crosshair layer paints only when the
    pointer is non-null and `pointer.viewId !== data.viewId`, sized in screen
    pixels;
  - `attach` subscribes to the pointer dep and requests a redraw on change,
    and once more when the pointer clears.
  - existing `minimapMath.test.ts` stays green.
- [ ] Implement `features/minimap/{actions.ts,layers.ts,createMinimapContribution.ts,index.ts,README.md}`;
  export from `index.ts`.
- [ ] `<MinimapCanvas>`: replace `openPointerSession` with a dispatcher over its
  canvas (isolated deps/actions/active-tool providers, shared pointer
  provider), `rootView` dep from `mainView`/`onMainViewChange`/`mainViewDims`,
  bindings unscoped; publish `{ viewId: id ?? 'minimap' }` on move and clear on
  leave; draw the crosshair from `usePointerPosition()`. Keep its props; add
  `id?`. `MinimapCanvas.test.tsx` keeps passing (adjust only what tests the
  removed session directly).
- [ ] Run minimap tests; commit.

### Task 5: demo and screenshot

- [ ] `MinimapDemo`: an in-surface minimap via `ambient={[minimap]}` and the
  detached `<MinimapCanvas>` beside it, both under one pointer provider, the
  main canvas carrying `createLinkedCursorContribution()`.
- [ ] Screenshot with the repo's headless visual harness
  (`tests/visual/`) — pointer over the main canvas shows the crosshair in the
  minimap and vice versa. Send the images to the wall.
- [ ] Commit.

### Task 6: docs

- [ ] `docs/extending.md`: open with the extension-unit table and the minimap
  as the worked multi-role example; "When it isn't a tool" folds into it.
- [ ] `docs/taxonomy.md` §6: replace "Plugin (deferred)" with an entry under
  §1 ("Contribution") saying `SurfaceContribution` is that unit; fix the §2
  "Distinct from a Plugin" link. `docs/TODO.md` "Plugin/bundling convention"
  entry: rewrite around what is left.
- [ ] `features/viewports/README.md` Related: mention the contribution.
- [ ] Changeset (`patch`) for routing, core, hud.
- [ ] Typecheck from the root (`npx tsc --noEmit`), then commit.

### Task 7: fleet run

- [ ] `onto test --ref origin/main` from the worktree; fix what it finds.
