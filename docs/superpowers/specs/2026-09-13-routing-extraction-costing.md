# Costing the routing extraction

**What this is:** the costing that preceded lifting weasel's routing layer —
binding-to-action dispatch — out of `@weasel-js/core` into `@weasel-js/routing`.
**All three arcs are done (2026-09-13); the package exists.** What is left here
is the measurement, kept for the parts that are still true about the boundary,
and corrected where the work disagreed with the prediction.

**Who it is for:** whoever next changes the routing boundary, or wonders why a
type sits where it does.

## The headline

**6,302 lines across 31 files.** The cycles this doc costed as the blocking
problem are gone — see "Arc 1 is done" below — so the question left is the
package, not the untangling.

| Group | Lines |
|---|---:|
| Dispatcher core (`dispatcher.ts`, `useGestureDispatcher.tsx`, `matcher.ts`, `predicates.ts`) | 3267 |
| Action registry and invocation | 1411 |
| Tool declaration and wiring | 704 |
| Route reflection (already its own subpath) | 509 |
| Contributions | 331 |
| Shared key helpers | 80 |
| **Total** | **6302** |

For scale, what stays behind: the actions themselves are 9,770 lines, builtin
tools 2,215, affordances 1,658, the chrome-caps rule engine 957.

## Arc 1 is done (2026-09-13)

Everything this doc filed under Arc 1 has landed on `main`. What the work
measured, against what this doc predicted:

**The knot was one component, not three cycles, and it was bigger than
counted.** A Tarjan pass over core's non-test imports found a single 15-file
strongly connected component spanning `contributions/`, `tools/`,
`interactions/actions/`, `depSchema.ts` and `dispatcher.ts`, closed by 10 value
edges. It is gone. Nothing in routing, tools or contributions is in a cycle now;
the only one left anywhere near is `distribute.ts` ↔ `plan.ts`, which is
unrelated.

**It came apart at the type level, not by moving files.** Four splits did it:
`Action` into `ActionDispatch` (what routing consults) and `ActionPresentation`
(what a palette renders); `Contribution` into `ContributionRouting` and
`ContributionChrome` the same way; `HotkeyTrigger` and `ToolPresentation` moved
from `tools/types.ts` to `contributions/types.ts`, where the fields that use
them already lived; and the dispatcher narrowed from `ActionsRegistry` to
`ActionSource`, the one method — `list()` — it ever called.

**The god-object is two files.** `registry.ts` is the store contract and the
registration validators, in plain TypeScript; `ActionsProvider.tsx` is the
context, the provider, the mute scope and the hooks. `actionBindings` and
`BoundGesture` went down to `binding.ts`, which already owned `GestureBinding`;
`evaluateEnabled` went to `actionEnabled.ts`, because the dispatcher calls
`action.enabled(deps)` raw and never used the wrapper.

**`ClaimableGesture` is in `@weasel-js/gestures`.** Its type closure was empty —
five string literals — so the zero-dependency package stayed that way.

## Two things are already done

**The matching half left core when `@weasel-js/gestures` was cut.** `matcher.ts`
re-exports `matchSpec`, `matchModifiers` and `parseTargetSpec` from that package,
and `tools/routing/{gestures,routeGrammar}.ts` are pure re-export shims. What
remains in core is scope and eligibility assembly, the stateful dispatcher, and
the React DOM seam.

**`@weasel-js/core/routing` is already a separate build target** with its own
`tsup` entry, covering route-grammar reflection. For that part the work is
promoting an existing subpath, not carving a new boundary.

## The one hard problem: `DepSchema`

`DepRegistry<K extends DepName>` where `DepName = keyof DepSchema` is typed
against a single global interface that consumers extend by declaration merging.
Two do it today — the 3D lab's `camera3d` and `apps/draw`'s `color`.

There are two candidate designs and the gap between them is most of the cost.

**Make the registry generic over a schema type parameter.** Principled, and it
turns `DepRegistry` / `Action.requires` / `ActionDeps` into a real contract
rather than a reference to one ambient interface. It is also a breaking change
to a public type, and every augmentation site has to be rewritten.

**Or move the mechanism with `DepSchema` declared empty**, and let core augment
it from outside exactly as the two consumers already do. Far cheaper, uses a
seam the repo has exercised twice, and needs no generic. The concrete dep
interfaces — all 24 — stay in core, which becomes just another consumer.

**The second design is what shipped, and the landmine this doc called unreal is
half real.** The claim was that declaration merging targets the module where an
interface is *declared*, so an augmentation still aimed at `'@weasel-js/core'`
after the declaration moved would silently stop merging. The first measurement
said it merges fine through one re-export hop, and that much holds. What it did
not try was two hops, which is the shape the extraction actually produces:
consumer augments `'@weasel-js/core'`, core re-exports from `'@weasel-js/routing'`,
and routing's barrel re-exports from a submodule where the interface is declared.

At two hops TS declares a *fresh* interface in the shadowed alias's scope rather
than merging, and the failure surfaces nowhere near the augmentation: every
`DepSchema[K]` inside routing's own source fails with TS2536, "Type 'K' cannot be
used to index type 'DepSchema'". Nine errors, all in files nobody had touched.

**The fix is one hop: declare `DepSchema` in routing's own `index.ts`,** the
module core re-exports from, not in a module that barrel re-exports. Consumers
keep naming `'@weasel-js/core'` and never learn the package exists. The standing
check is `scripts/smoke-consumer-bundle.mjs`'s `smokeDep` augmentation, which now
guards this against the *published* `.d.ts` — the only place the flattening is
visible.

What did happen here once was narrower: `depRegistry.tsx` records a
*self*-augmentation — core's own `declare module './depRegistry'` — dying when
`rollup-plugin-dts` flattened both files into one `.d.ts` chunk, at which point
the augmented module no longer existed separately. That is a build-shape
failure, not an aliasing one, and `dts: true` is still how core emits
declarations.

The hand-run experiment is now a standing check: `smoke-consumer-bundle.mjs`
declares a `smokeDep` against the *published* `.d.ts` and asserts both it and
the kit's own keys resolve. That covers the flattening path the experiment could
not.

### The schema is less 2D than the phrase suggests

Of 24 deps: 8 neutral, 3 already generic over the pose, 13 nominally 2D-bound —
but only **10 are genuine obstructions**. `areaSelect`, `nodeAtPoint` and
`insert` look planar and port unchanged, because they are screen-space
operations whatever sits behind the screen; the 3D lab implements all three by
rebuilding the ray from the camera the dep closes over. The real residue is
`view` (no orientation — the one outright dead end), `pointer`, `snap`,
`lassoSelect`, `editAnchors`, `poseDescriptor`, `booleansAdapter`, `slice`,
`ingestion` and `geometryProjection`.

## React makes this a different animal from its siblings

The mechanism is genuinely pure — `dispatcher.ts` says "pure module, no React,
no DOM" in its header and that holds for `matcher.ts`, `predicates.ts`,
`binding.ts`, `buildDeps.ts` and `invoker.ts`.

But `useGestureDispatcher.tsx` (1,497 lines) is the only code in the repo that
assembles a `DispatcherContext` and pumps DOM events into it, and it draws from
three React contexts. Neither `gestures` nor `history` has a React dependency at
all. So the package either takes React on — unlike both siblings — or ships a
pure dispatcher with no precedent for driving it.

**Ship one package with two entry points**: the pure dispatcher as the main
entry, the React seam behind a `/react` subpath with React as a peer. The repo
already builds `@weasel-js/core/routing` as a second target, so the shape is not
new. Keeping the seam in core instead would leave any second kernel pulling core
back in to drive routing at all, which defeats the point.

## Three smaller obstructions (resolved)

All three are resolved — see "Arc 1 is done" above. They were: `registry.tsx`
as a god-object holding both the `Action` authoring type and the dispatch
runtime; `ClaimableGesture` leaking into `matcher.ts` and `invoker.ts` from
affordances; and `Tool`/`Contribution` bundling routing fields with chrome ones,
so the boundary ran through the types rather than between them.

## What the last extraction actually cost

Worth knowing before anchoring on it: **the `gestures`/`history` arc was mostly
packaging, not decoupling.** An audit at the time found geom and gestures import
nothing from core; only `history` had real coupling, at three symbols in two
files. The whole thing ran in a single four-hour window on 2026-07-26 across
four short-lived branches, because there was almost nothing architectural to
undo. Routing is not that.

Two things from it that do transfer:

**Three separate couplings resolved to one pattern** — an optional injected
callback or value that core always supplies and the package is silent or no-op
without: `rebuildOp`, `HistoryLogger`, and later `unpackSvgFiles`. That is the
shape routing's seams should take.

**Seven latent correctness faults surfaced 27 days later**, once the extracted
packages got a standalone correctness pass: a boolean-ops hole bug, two
non-terminating `flattenCubic` inputs, a broken `approxEq` at infinity, an
absolute-epsilon bug in `Mat3.invert`, a history-coalescing bug that could merge
the wrong undo entries, a double-active-journal bug, and an unexported type pair
caught only by `tsc`. They had been there all along. Budget for the same pass
here; it does not appear in any diffstat.

## Per-package overhead

Modest and known. A new Tier A/B package needs `package.json`, a thin
`tsconfig.json`, a 3–4 line `tsup.config.ts` off the shared preset, `LICENSE`
and `README.md`. Four root files must be touched: `tsconfig.json` (paths and
include), `package.json` (the `build:leaves` fan-out, which npm does not order
topologically), `.changeset/config.json` (the `fixed` group is enumerated, not a
glob), and `scripts/smoke-consumer-bundle.mjs`. Vitest registration is free —
the `weasel-ui` project already globs `packages/**/*.test.ts`.

## Blast radius

Small. `packages/diagram` (`connect.ts`, `portAffordance.ts`, `layoutAction.ts`),
`packages/hud`, one `packages/ui` test, `apps/draw`, three `apps/site` demos, and
`packages/labkit/examples/3d-lab` — one to four call sites each. Because core
would re-export the moved symbols, none of these break. Only the two
`declare module` augmentations do, and silently.

## The shape of the work

**Arc 1 — untangle, inside core, no package. Done.** See above.

**Arc 2 — move it. Done (2026-09-13).** Both augmentation sites were left naming
`'@weasel-js/core'` and merge unchanged, as predicted — but only because
`DepSchema` is declared at the right depth; see the DepSchema section.

**Arc 3 — the correctness pass. Done (2026-09-13).** See
"What arc 3 found" below.
