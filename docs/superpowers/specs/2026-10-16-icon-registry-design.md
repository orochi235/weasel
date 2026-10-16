# Icon registry: namespaced names, per-package tables, a build plugin that ships only what's used

**Unbuilt as of 2026-10-16.** Design approved in conversation; no code exists yet.

For whoever implements it. Assumes you know weasel's package layout, actions and
`FeaturePreset`, and nothing about how icons work today.

**The question this answers:** how an action, a tool, a prefs leaf or a component
names an icon, where the glyph for that name comes from, and how a build ships only
the glyphs it names, while still letting a picker browse all of them.

## Today

| Who | Source | Reached by |
|---|---|---|
| `@weasel-js/ui` set | `packages/ui/scripts/icons/*.mjs` → `gen:icons` → `src/icons/generated/{paths,fills,groups}.ts` | Name: `<Icon name>`, `namedGlyph(leaf.icon)` |
| core tools | `packages/core/src/icons/*Icon.tsx`, hand-written JSX | Component, as `Tool` icon |
| core actions | `core/src/interactions/actions/defaults/icons/*Icons.tsx` | Component, as `action.icon: ReactNode` |
| path-tools | its `*Icons.tsx` files, exported from `index.ts` | Component |
| apps/draw | `src/actionIcons.tsx` | Component |

`ACTION_GLYPHS` (delete, undo, redo, measure, tune) is the only bridge: drawn in ui's
definitions, generated into core. A `leaf.icon` string the ui set lacks draws nothing,
silently. Nothing is a registry, and no build drops unused glyphs.

## Names

- **Qualified names are `namespace:name`** — `core:undo`, `ui:close`, `path-tools:reversePath`.
- **The publisher declares the namespace.** Nothing derives it from the npm name. The kit's
  convention is one namespace per package, named after the package without its scope.
- **A namespace belongs to one owner.** A table carries its `owner` (the publishing package's
  name). A second table claiming a registered namespace merges into it when the owner matches
  (the plugin's eager subset of `core`, then the full `core` table from the `all` variant) and
  is refused when it does not. Replacing a single icon is explicit: `override: true` on
  that icon. A whole namespace is never taken over.
- **Inside a package, names may be bare.** Each package's `icon()` is bound to its own
  namespace: in core, `icon('undo')` is `core:undo`. A bare name resolves only against the
  calling package. There is no fallback search. `icon('close')` in core is a type error;
  write `icon('ui:close')`.

## `@weasel-js/icons`

A new package. No React, no DOM, no glyphs. It depends on `@weasel-js/registry`, and
sits below core and prefs.

| Export | What it is |
|---|---|
| `IconName` | Interface whose keys are qualified names. Packages and apps extend it by declaration merging. |
| `IconRef` | A branded string. Only `icon()` produces one, so a bare string literal fails the typecheck wherever an `IconRef` is required. |
| `scopedIcon(ns)` | Builds a package's `icon()`. At run time it qualifies a bare name and returns it. |
| `IconTable` | `{ namespace, owner, icons: Record<name, { body, fill?, group, tags }> }` |
| `createIconRegistry()` | Built on `createReflectable`. Enforces the namespace rules above, and loads variants (below) on request. |
| `./plugin` | `weaselIcons()`, written once with `unplugin`: `.vite` for vite and vitest, `.esbuild` for tsup, `.rolldown` for a bare rolldown build. One implementation; a separate adapter only if `unplugin`'s esbuild output fails under tsup. |
| `./virtual` | `declare module` types for `virtual:weasel-icons` and its variants, so the import typechecks. |

The package holds no module-level state, so having two copies installed breaks nothing
(compare `docs/proposals/2026-08-31-singleton-packages-as-peers.md`).

## Per package

Each package that owns icons has:

- `icons/*.mjs`: its definitions, beside the code that uses them. The shared helpers
  (`base.mjs`'s `chevron`, `chevronOn`, terminus math) move into the icons package's scripts.
- `src/icons.gen.ts`: generated. Holds its bound `icon()` and its `IconName` augmentation.
- `icons/index.mjs`: declares its namespace and owner and lists its groups, in the order
  they are drawn. Apps here have no `package.json`, so the declaration lives with the
  definitions rather than in a manifest.
- `src/icons.table.json` and `src/icons.table.ts`: the generated table, as data the plugin
  reads in Node and as a module.
- A `./icons` export (published packages): the table module; and a `"weaselIcons": { "table": … }`
  field in `package.json` pointing at the JSON, which is how the plugin finds an installed
  package's table. For source in the build, the plugin finds the table beside the
  `icons.gen` module the source imports.

`gen:icons` reads every package's definitions and writes each package's table and
`icons.gen.ts`, plus a repo manifest (namespace, name, group, tags) for the site's gallery
and forge stories. It fails on a duplicate namespace, a duplicate name within a
namespace, and an `icons/` directory its glob does not match.

No published table aggregates every kit package. `@weasel-js/icons` can't hold one,
because core depends on it.

## Consumers of a name

`action.icon`, tool icons and `leaf.icon` (prefs) all become `IconRef`. Every
`createElement(GroupIcon)` becomes `icon('group')`. ui is the only package that draws:
`<Icon name>` takes an `IconRef`, and `actionIcon()` and `namedGlyph()` fold into one
registry lookup. A name the registry lacks draws `UnknownIcon`'s placeholder and warns
in dev, and draws nothing in production.

The `…Icon` React components core, ui and path-tools export today are removed outright,
with no deprecation period. `<Icon name={icon('core:rect')} />` replaces them.

## The registry at run time

`WeaselProvider` holds one registry, preloaded from its `icons` prop:

```tsx
import used from 'virtual:weasel-icons';

<WeaselProvider
  icons={used}
  iconVariants={{
    all: () => import('virtual:weasel-icons/all'),
    picker: () => import('virtual:weasel-icons/picker'),
  }}
/>
```

Without the plugin, an app passes tables directly: `icons={[coreIcons, uiIcons]}`.

The registry's React context lives in core (`IconRegistryProvider`, `useIconRegistry`). `WeaselProvider` mounts it with its props, and `SceneCanvas` mounts an empty one only when none is in scope, the way it treats every other kit provider. Apps here mount `WeaselProvider` today in none of their roots, so apps/draw, the site and forge's story frame each gain one. A component rendered with no provider in scope (a jsdom unit test, say) finds no glyphs and draws the placeholder; tests that read a glyph wrap themselves in a provider. No glyph table is imported as a fallback, because that import would defeat trimming.

Library components that browse (PrefSchemaEditor's icon picker, which replaces the free-text `icon` field it has today with an `icon` attribute kind, the way `showIf` has `condition`) ask for a variant by
name — `useIconVariant('all')` — and never import a virtual module. The registry runs the
app's loader once, adds the tables, and notifies through `subscribe`. A variant with no
loader falls back to whatever is registered, with a dev warning.

Presets carry no icons. Icons are settled when the app is built, not when a canvas mounts.

## The plugin

`weaselIcons()` from `@weasel-js/icons/plugin`, in two modes.

**Library mode** (each kit package's build: `weaselIcons.esbuild` under tsup, `weaselIcons.vite` under vite) rewrites `icon('undo')` to
`/* @icon */ 'core:undo'`. `dist` ships the qualified, annotated literal and no call.

**App mode** (the consumer's vite build, apps/draw, the site):

- Rewrites the app's own `icon()` calls the same way. It reads the namespace for bare names
  out of the generated `icons.gen` module the call's `icon` was imported from.
- In `transform`, collects every `@icon` literal in the module graph, `node_modules`
  included, and records which package each module belongs to. It needs no globs: the
  bundler hands it every module the build pulls in.
- At the end, resolves `<pkg>/icons` for every package seen, reads each table in Node,
  and writes only the referenced glyphs into `virtual:weasel-icons`. That module is
  emitted as a placeholder and filled in at `generateBundle`, once every module has been seen.
- Fails the build on a namespace no package in the build provides, or a name missing from
  its namespace's table, naming the referring module.
- **Variants:** `virtual:weasel-icons` (referenced glyphs, eager), `/all` (every table
  found), `/<namespace>`, and custom variants filtered by namespace, group and tag
  (`registry`'s `hasTag`). Each is its own chunk, so a variant other than the default
  costs nothing until something loads it.
- In dev and under vitest every variant is full. Vite pre-bundles `node_modules` with
  esbuild, which skips the plugin's hooks, so a trimmed dev set would miss kit calls.

**Measure first:** whether a variant should ship a metadata-only catalog chunk (names,
groups, tags) ahead of its glyph bodies, so a picker can list everything before
downloading anything. Decide from byte counts of `/all`, gzipped, not from the size of the
source file.

## Migration order

1. `@weasel-js/icons`: types, `scopedIcon`, the registry.
2. `gen:icons` generalized across packages. ui's existing definitions move to the `ui`
   namespace and export from `@weasel-js/ui/icons`.
3. The hand-written JSX icons in core, path-tools and apps/draw are converted to `.mjs`
   definitions in their own packages. `ACTION_GLYPHS` goes away.
4. `action.icon`, tool icons and `leaf.icon` become `IconRef`. `WeaselProvider` takes
   `icons` and `iconVariants`. The `…Icon` components are removed.
5. The plugin: library mode in every kit package's build, app mode in apps/draw and the site.
6. PrefSchemaEditor's picker reads `useIconVariant('all')`.

## Tests

| Covers | How |
|---|---|
| `scopedIcon`, namespace refusal, `override` | Unit tests in the icons package |
| `gen:icons` | Duplicate namespace, duplicate name, unmatched `icons/` directory each fail |
| Plugin | A fixture app built with Rollup: only referenced glyphs present, a missing namespace fails, a custom variant's filter holds, the `@icon` annotation survives a tsup library build |
| `<Icon>` from the registry, variant loading | `*.browser.test.tsx`; jsdom can't show that a glyph drew |
| The consumer side | `test:smoke:consumer` builds the packed packages with the plugin and asserts the bundle holds exactly the glyphs the fixture names |
