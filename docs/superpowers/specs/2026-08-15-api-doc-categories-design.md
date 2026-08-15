# Categories for the generated API docs

A design for the typedoc build, for whoever implements it. It answers: how does
`dist-demo/api` stop being one flat list of 397 functions, without moving a
single source file or changing an import path?

## The problem

The generated API index groups by *kind*: Namespaces, Classes, Interfaces, Type
Aliases, Variables, Functions. That is a fact about TypeScript, not about
weasel. A reader looking for "how do I hit-test a path" scrolls a 713 KB
`modules.html` alphabetically.

The grouping a reader wants already exists. `packages/core/src/index.ts` carries
40-odd section headers — "Viewport: ViewTransform + helpers", "Paths: data,
builders, hit-tests, boolean ops, pen preview", "Op model: every scene mutation
routes through here" — written as `//` comments, which typedoc cannot see.

`routing` is the sole entry under Namespaces, which makes it look like a
deliberate architectural tier. It is not; it is the unfinished half of the
2026-05-12 declarative-routing plan, whose Phase 6 was to move `defineTool` up
to `src/tools/` and re-export it from the barrel. **That relocation is out of
scope here** and this design does not depend on it either way.

## Categories are assigned by source path

TypeDoc reads `@category` from a symbol's docstring. Writing 250 of them means
touching 250 definitions across the tree, and puts the taxonomy in 250 places
where it drifts independently.

Instead a local plugin assigns categories from the declaration's **source
path**, driven by one config file. A symbol defined under `core/viewport/` is
Viewport because of where it lives, not because someone remembered to tag it.

```
typedoc/
  categories.mjs         # ordered [path, category] rules + name overrides
  categoryOf.mjs         # pure (sourcePath, symbolName) => category | null
  categoryOf.test.mjs
  plugin.mjs             # converter hook; feeds reflections to categoryOf
```

Plain ESM rather than TypeScript: TypeDoc `import`s a plugin at runtime and has
no TS loader, and splitting the taxonomy into `.ts` files a `.mjs` plugin then
imports buys types at the cost of a build step for four small files.

The judgment lives in `categories.ts`; the pure resolution lives in
`categoryOf.ts` and is unit-tested without running typedoc; `plugin.mjs` is the
adapter and stays small enough to re-verify by reading it after a typedoc
upgrade.

Rules are **ordered, first match wins**, so a specific path can precede a
general one:

```ts
['core/ops/createHistory*', 'History'],
['core/ops/**',             'Scene'],
```

That pair is a real case, not an illustration: `createHistory` lives under
`core/ops/`, so the general rule would swallow it.

`overrides` is keyed by exported symbol name and beats every path rule. It
exists for the symbol whose file is a poor guide to its subject — not as a
general escape hatch. An override that could be a path rule should be one.

## The ten categories

| Category | Principal sources |
|---|---|
| Scene | `core/scene`, `core/ops`, `core/adapters`, `features/groups` |
| Rendering | `renderer`, `canvas`, `canvas/SceneCanvas` |
| Tools & gestures | `tools`, `tools/builtin`, `interactions/gestures` |
| Selection & actions | `interactions/actions`, `core/selection`, `features/selection` |
| Paths & geometry | `features/paths`, `features/paths/curves` |
| Viewport | `core/viewport` |
| Paint & fills | `features/patterns`, `core/paint-types`, `util/paint` |
| Text | `features/text`, `interactions/actions/defaults/enterTextEdit` |
| History | `core/ops/createHistory` |
| Extension points | `contributions`, `layout/strategies`, `features/ingestion`, `routing` |

`categoryOrder` fixes this sequence in the sidebar. Alphabetical would open on
"Extension points", which is the last thing a new reader needs.

166 distinct modules feed the barrel, so expect roughly 30 rules. `features/` is
the one directory that needs several: its children (paths, patterns, guides,
focus, ingestion, parallax, groups, selection) belong to different categories,
though each child is coherent on its own.

## An uncategorized export fails the build

The plugin collects every top-level export that matched no rule and throws,
naming each symbol and its path:

```
✗ 2 exports match no category rule:
    useSliceTool        src/tools/builtin/slice/
    TilePatternSpec     src/features/patterns/
```

This is the same posture as `check:bumps` and `check:manifests`: a new export
cannot drift out of the taxonomy silently, because the cost of noticing is paid
by whoever added it rather than by a reader six months later. The price is that
adding an export in a genuinely new directory means adding a rule.

Only the module's own children are checked. Class methods and interface members
inherit their parent's category and are not separately assignable.

## Configuration

`typedoc.json` gains `plugin`, `categoryOrder`, and `categorizeByGroup: false` —
categories *replace* kind-grouping rather than nesting inside it, so a category
page lists its interfaces and functions together instead of splitting them.

## What this does not touch

No source file moves. The flat barrel keeps all 251 exports, every import path
is unchanged, and no symbol is renamed or removed. `@weasel-js/core/routing`
keeps working, and the `routing` namespace keeps rendering as a namespace —
under a category rather than alone.

## Risks

**The injection point is unproven.** TypeDoc computes categories during resolve,
so the tag has to land before that. First implementation task is a spike on two
or three symbols confirming the hook fires early enough. If injecting a comment
tag does not hold on 0.28, the fallback is writing `categories` onto the
reflection directly during resolve.

**Plugin API churn across typedoc majors.** Mitigated by keeping the hook
minimal: an upgrade re-verifies `plugin.mjs`, while the taxonomy and its tests
are plain TypeScript that no upgrade can break.

## Verification

- `categoryOf.test.ts` — the pure mapping: first-match ordering, override
  precedence, and a null for an unmatched path.
- A build with a rule deliberately removed must fail, naming the orphaned
  symbols. Assert the failure, not just the success.
- `npm run build:api`, then read the index: ten categories in the intended
  order, nothing in an "Other" bucket, and `routing` no longer alone.
