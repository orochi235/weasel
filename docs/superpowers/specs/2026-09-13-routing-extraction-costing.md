# Costing the routing extraction

**What this is:** a measurement of what it would take to lift weasel's routing
layer — binding-to-action dispatch — out of `@weasel-js/core` into its own
package beside `gestures` and `history`. Measured 2026-09-13 against `main`.

**Who it is for:** whoever decides whether to do it, and then whoever does.

**What it answers:** `2026-08-22-3d-kernel-design.md` concluded that routing is
portable and the dep schema is not, and recorded that nobody had costed it.
This is that costing. It does not recommend a schedule; it says what the work
is, which parts are cheap, and which one thing is genuinely hard.

## The headline

**6,302 lines across 31 files**, and the cycles mean almost none of it can go
alone. A routing package cannot take "just the dispatcher": `dispatcher.ts`
imports `actionBindings` from `registry.tsx` as a value while `registry.tsx`
imports `Dispatcher` back, `tools/types.ts` and `tools/routeTypes.ts` import
each other, and `tools/*` and `contributions/*` form a three-way knot. The
actions registry, the tool-declaration types and the contributions layer all
move together or none of them do.

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

**The second design is the recommendation, with one landmine stated plainly.**
TypeScript declaration merging targets the module where an interface is
*declared*, not one that re-exports the type. An augmentation still aimed at
`'@weasel-js/core'` after the declaration moves silently stops merging: no
runtime error, no build error, the dep simply type-checks as absent. Both
augmentation sites are a two-line retarget and nothing catches a missed one.
This failure has already happened here once — `depRegistry.tsx` carries a
comment recording that `rollup-plugin-dts` flattening two files into one `.d.ts`
chunk emptied `DepSchema` for consumers.

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

## Three smaller obstructions

**`registry.tsx` is a god-object.** 712 lines that are simultaneously the
`Action` policy-authoring type — `icon`, `group`, `shortcut`, `enabled` — and the
dispatch runtime. Either split the file, or accept that the new package's central
public type carries palette fields with nothing to do with dispatch.

**`ClaimableGesture` leaks in from affordances.** `matcher.ts` and `invoker.ts`
both import it from `affordances/types`, a subsystem that is otherwise rendering
and hit-test geometry and stays in core. The type wants to move to
`@weasel-js/gestures` first.

**`Tool` and `Contribution` mix concerns.** Both bundle routing fields
(`bindings`, `eligibility`) with non-routing ones (`overlay`, `presentation`,
`ToolCtx`) in one interface, so the boundary runs through the types rather than
between them.

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

**Arc 1 — untangle, inside core, no package.** Split `registry.tsx`'s authoring
type from its runtime. Break the `dispatcher.ts` ↔ `registry.tsx` cycle. Move
`ClaimableGesture` to `@weasel-js/gestures`. Separate the React providers from
the plain data types they share a file with. Settle the `DepSchema` shape. This
is the bulk of the thinking, it carries no packaging risk, and it leaves the tree
better whether or not the package ever ships.

**Arc 2 — move it.** Mechanical once Arc 1 lands: the package scaffold, the file
moves, core's re-exports, and retargeting the two augmentation sites.

**Arc 3 — the correctness pass.** On the precedent above, expect it to find real
bugs that predate the move.

The honest summary: **Arc 1 is the whole question.** If the untangling is worth
doing on its own terms — and the god-object and the two cycles argue it is — the
package is a cheap step afterwards. If it is not, the extraction is not either.
