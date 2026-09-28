---
"@weasel-js/routing": patch
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

"Tool" now names only a contribution that can hold focus — one a user picks from a palette or holds on a key — and `isTool(entry)` is the test. What holds every kind of entry takes `Contribution` and says "entry":

- `useGestureDispatcher`'s and `DispatcherContext`'s `toolsById` is `entriesById`, a map of `Contribution`.
- `ownerToolId` is `ownerId` on `ScopedBinding`, `MatchResult` and a dispatch record's `RecordCandidate`.
- `RegistryEntry.toolId` is `ownerId`, and `Conflict.toolIds` is `ownerIds`.
- `<SceneCanvas ambient>` takes `SurfaceContribution[]`, and `useTools`'s `ambient` (and `ToolsApi.ambient`) takes `Contribution[]`, so a contribution no longer needs casting to `AnyTool`.
- `findConflicts`, `findScopedConflicts` and `buildRouteRegistry` take `Contribution`s.
- `defineViewportTool` and `ViewportToolDef` are removed; they were `defineTool` and `ToolDef` under another name.
- `FallthroughDiagram`'s "Tool" column is "Owner".

These are breaking renames for any consumer reading those fields or calling the removed function.
