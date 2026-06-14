# Bundle Inspector — Design

**Date:** 2026-05-16
**Status:** Approved (pending user spec review)
**Mount point:** `#/dev/registry` in `apps/swillustrator`
**Sibling of:** `#/dev/toolkits` (ToolkitBuilder)

## Purpose

A read-only catalog browser for everything the kit registers. One page where you can find what tools, actions, shape kinds, bundles, and icons exist, click any of them, and see metadata plus a visual preview where applicable.

ToolkitBuilder remains the place to *assemble* a canvas from primitives and inspect routing conflicts. The Bundle Inspector is for *browsing the catalog itself*.

## Non-goals (v1)

- Editing or invoking entries (no live "try in sandbox" — that's ToolkitBuilder).
- Conflict cross-references (already in ToolkitBuilder).
- Persisted URL state for the selected leaf or filter.
- Diffing between bundles.

## Layout

Two-pane split with a header bar.

- **Header bar:** title + a **bundle filter dropdown** (`All bundles` / `default` / `swill` / `minimal` / …). When a specific bundle is selected, the tree narrows to items that appear in that bundle. `All bundles` shows everything.
- **Left pane — tree:** a text-input filter at the top, followed by a categorized expand/collapse tree with these top-level nodes:
  - Tools
  - Actions
  - Shape kinds
  - Bundles
  - Icons
  - Op factories *(low priority — drop if it adds material complexity)*
  - Public exports *(low priority — drop if it adds material complexity)*

  The text filter matches leaf ids; matching leaves stay visible and their parent nodes auto-expand. The selected leaf is visually highlighted.
- **Right pane — detail:** metadata plus a visual preview when one is meaningful.

## Detail-pane content by leaf type

| Leaf type | Metadata | Visual |
|---|---|---|
| Tool | id, shortcut, owning hook name, source-file path, JSDoc snippet, action ids it contributes, cursor name | Tool icon |
| Action | id, shortcut(s), keymap entry, owning hook name, source-file path, JSDoc snippet | Action icon |
| Shape kind | kind name, default pose schema (JSON), interacting op factories | Small SVG/canvas rendering a default instance |
| Bundle | name, member tool ids, member action ids (each clickable, navigates the tree) | None |
| Icon | name, intrinsic size | Icon rendered at 32px and 64px |
| Op factory | name, source-file path, JSDoc snippet | None |
| Public export | name, source-file path, JSDoc snippet | None |

## Data sources — hybrid

Two collection paths, combined into one typed tree consumed by the UI.

### Runtime introspection
Mount a hidden `<SceneCanvas>` configured with the union of all known tools and actions (the same primitives ToolkitBuilder already uses). Read live data from:
- `useActionsRegistry` for action ids, shortcuts, keymap entries, route table
- The kit's tool registry for tool ids, owning hooks, cursor names, contributed action ids
- The kit's bundle exports for bundle membership

### Static (barrel imports)
For things not exposed through a runtime hook:
- **Icons:** `apps/swillustrator/src/actionIcons.tsx`, `kindIcons.tsx`
- **Shape kinds:** the kit's exported node-kind catalog
- **Op factories, public exports:** named exports from `@weasel-js/core`'s barrel

### Source-file paths & JSDoc snippets
A small Vite `import.meta.glob('...', { as: 'raw' })` over `src/**/*.{ts,tsx}` (and the kit's `src/**/*.{ts,tsx}`), pulled lazily on selection so it doesn't bloat the dev bundle. A leaf lookup matches by exported symbol name and reads the JSDoc immediately preceding the export.

## Routing

`apps/swillustrator/src/main.tsx` already switches on `location.hash`. Add a case: when `location.hash === '#/dev/registry'`, render `<RegistryInspector />`.

## Files added

- `apps/swillustrator/src/dev/RegistryInspector.tsx` — top-level component
- `apps/swillustrator/src/dev/RegistryInspector.module.css` — styles
- `apps/swillustrator/src/dev/registryData.ts` — collectors that produce the typed tree of entries from runtime + barrel + raw-source sources
- `apps/swillustrator/src/dev/registryTree.tsx` — tree component (may be folded into `RegistryInspector.tsx` if it stays small)

## Risk & follow-up

The hybrid data source means anything added to the kit but not re-exported through its barrel will not appear in the inspector. This is the same drift risk the kit already has, but the inspector makes it more visible.

A TODO item is added to `docs/TODO.md` to either:
- generate the inspector manifest from kit source at build time, or
- enforce barrel registration via a lint check.

## Acceptance

- Navigating to `#/dev/registry` shows the inspector with a populated tree.
- Each of the seven category nodes (at minimum the first five — op factories and public exports may be dropped) expands to real entries.
- Selecting any leaf renders the right-pane detail for its type with the correct visual where applicable.
- The bundle filter narrows tools/actions to bundle membership.
- The text filter narrows the tree and auto-expands matched leaves' parents.
