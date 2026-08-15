---
'@weasel-js/core': patch
---

The `routing` namespace is gone from the main barrel, and the reflection
surface exports only what a consumer can use.

`export * as routing` made tool authoring reachable two ways — `core.routing.defineTool`
and the `@weasel-js/core/routing` subpath — and no consumer ever used the first.
It survived as the unfinished half of the 2026-05-12 declarative-routing work,
whose Phase 6 was to move `defineTool` out of `routing/` entirely. **Removing
it is a breaking change for anyone importing the namespace form**; the subpath
is unchanged and is what every known consumer already uses.

`tools/routing/reflection` now exports `buildRouteRegistry`, `findConflicts`,
`RegistryEntry` and `Conflict` — the four an external inspector needs.
`PREDICATE_TARGET`, `findScopedConflicts`, `formatConflict`,
`reportRouteConflicts` and `ToolScopes` are still there and still used; they
are just no longer public, since their only caller is inside the kit.
