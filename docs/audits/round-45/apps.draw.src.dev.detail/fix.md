- Gesture detail calls tool bindings the "legacy phase grammar" (A+B): fixed 5c1d990a90
- PhaseOutputDetail describes `initial.overlay` and the unreachable `claimsAll` branch (A+B): duplicate of the phase-grammar finding, fixed in the same commit 5c1d990a90. The blurbs are now a `Record<keyof ToolOutputs, string>`, so a new output fails typecheck until someone describes it.
- Action-binding rows collide when two bindings produce the same route text (A): fixed b3333e36cf (each row is keyed by the action id and the binding's index)
- A shape kind with no mounted tool shows another package's export as its source and doc (B): fixed 3a164aa21b (`tool` is set only when a tool is mounted, and the source lookup runs only on the hook name)
- OpKindDetail names an `ops.*` factory that doesn't exist for a kind added through `registerOpFactory` (B): fixed 2f644a1ec3
- RouteBadge drops a hover route's `held` requirement (B): fixed 091d44795e

Extra defects found while fixing:
- `badgeTokens.ts` still gave `claimsAll` as an example of a boolean field (sweep): fixed 5c1d990a90

No changesets: `apps/draw` has no package.json, so it isn't a published package and none of these changes reaches a consumer. Nothing went into `docs/unruled.md`. Every new test failed before its fix.

Checks:
- `npx vitest run --maxWorkers=1 apps/draw/src/dev/RegistryDetail.test.tsx`: pass (26/26)
- `npx vitest run --maxWorkers=1 apps/draw/src/dev/registryData.test.tsx`: pass (17/17)
- `npx vitest run --maxWorkers=1 apps/draw/src/dev/RegistryInspector.test.tsx`: pass (4/4)
- `npx vitest run --maxWorkers=1 apps/draw/src/dev/RegistryInspector.selection.test.tsx`: pass (3/3)
- `npx vitest run --maxWorkers=1 apps/draw/src/dev/registryProbe.test.tsx`: pass (7/7)
- `npx eslint` on all 8 changed files: pass
- `npm run checks:gate`: pass ("checks:gate: all 32 passed", including `typecheck`, every `check:*`, `lint` and `typecheck:packages`)
- `npm run lint -w <pkg>`: not run, because no workspace package changed (`apps/draw` isn't a workspace).

The tree is clean apart from `.skulk/`.