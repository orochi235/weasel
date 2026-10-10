# API reference for every package

**Status: designed 2026-10-10, not built.** Nothing below exists yet. Delete this file when the work merges.

For whoever implements it. It answers: how does every `@weasel-js` package get an API reference on
the demo site, where today only `core`, `gestures`, and `prefs` have one.

This is the first slice of a docs minisite per package. Overview pages, guides, and demos per
package come later and are out of scope here.

## What changes for a reader of the site

| | Today | After |
|---|---|---|
| Packages with a reference | `core`, `gestures`, `prefs` | Every published package |
| Where | `/api/`, `/api-gestures/`, `/api-prefs/`, three separate sites | One site at `/api/`; each package is a module in it, with its README as that module's landing page |
| Search | Per site | One box across every package |
| A symbol re-exported from another package | Links only where `typedoc.json` hand-maps it (five symbols) | Links to the page in the package that owns it |
| Subpath entries such as `@weasel-js/geom/booleans` | Undocumented; each run reads only `src/index.ts` | Documented |

`/api-gestures/` and `/api-prefs/` go away. Core's page URLs gain a module segment, so links to
individual core pages from outside the site break; links inside the repo get updated in the same
change.

## Design

**One TypeDoc build using the `packages` entry point strategy.** TypeDoc converts each package with
its own options, then merges the results into one project. The root `typedoc.json` names the
packages and carries the options they share; each package's `typedoc.json` carries only what is its
own.

- **Root `typedoc.json`:** `entryPointStrategy: "packages"`, the package list, `out: dist-demo/api`,
  and a `packageOptions` block holding what every package shares (`excludePrivate`,
  `excludeInternal`, `excludeExternals`, the test-file `exclude`, `skipErrorChecking`,
  `readme: README.md`).
- **`packages/<name>/typedoc.json`:** `entryPoints`, one per public entry in that package's
  `exports` map, plus its own `intentionallyNotExported` list where it has one.
- **Which entries are public:** every `exports` key except `./package.json`, `./test-seams`,
  `./internal`, and stylesheet entries.
- **Which packages:** every directory under `packages/` with a `package.json` that is not
  `private`. `packages/den` and `packages/weasel-js` have none and are skipped.
- **Core's categories stay.** `typedoc/plugin.mjs` sorts core's exports into navigation categories
  and fails the build on one it cannot place. It applies to core only; the other packages list
  their exports flat.
- **Removed:** the `build:api:gestures` and `build:api:prefs` scripts, both
  `externalSymbolLinkMappings` blocks, and the two extra API links in the site's sidebar header.
  `build:api` becomes a single `typedoc` call.

### Keeping the entry lists honest

A package that gains a subpath export and not a matching `entryPoints` line would be silently
undocumented. `npm run check:api-entries` compares each package's `exports` map against its
`typedoc.json` and fails on a public entry with no entry point, or a published package with no
`typedoc.json`. It runs in CI beside the other `check:*` scripts.

### Not changing

- labkit's VitePress site at `/labkit/` and the forge workshop at `/docs/ui/forge/` stay as they
  are. Both packages also appear in the merged reference.
- The pages workflow still copies `dist-demo/` as a whole, so the deploy step needs no edit beyond
  what the removed directories imply.

## Unverified

The `packages` strategy has not been run against this repo. Two behaviors this design depends on
are from TypeDoc's documentation, not from a build here:

- a symbol core re-exports from a sibling renders as a link to the sibling's page;
- `typedoc/plugin.mjs`, which walks `context.project.children`, can be limited to core's
  conversion.

The first implementation step is a build of three packages (`core`, `gestures`, `prefs`) to confirm
both before the other configs are written. If re-exports do not link, the fallback is separate
sites per package, which would bring back hand-kept link mappings and is a different design: stop
and redesign.

## Verifying the result

- `npm run build:api` exits 0 with TypeDoc's invalid-link validation treated as an error.
- Every published package has a module page under `dist-demo/api/`.
- `PrefGroup` on core's `NodePropertiesEntry` page links into the prefs module, and the pointer
  event types link into the gestures module: the five links the hand mappings carry today.
- `npm run check:api-entries` passes, and fails when an entry is removed from one package's config.
