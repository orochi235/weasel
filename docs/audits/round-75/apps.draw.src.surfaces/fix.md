The command-row bar ignoring stored item order (A) — fixed 4674fb9804. B said command-row assets never get a stored order, and no code writes one, so in practice it only shows with a hand-edited or imported prefs file. Even so, the asset's menu and panel use the stored order and its bar didn't, so one asset showed its items two ways. The bar now gets `order` too. I passed `order` only, not `onReorder`: letting users drag-reorder command-row bars would be a new behavior, not a fix. apps/draw isn't a published package, so it gets no changeset.

The View menu's "screen order" claim was wrong once an asset moves (A) — fixed e7c768611e. `CHROME_ITEMS` feeds the menu-bar schema and the action registration, and both are built once when the module loads. So I made the doc comment match what the code does: the list follows each asset's default surface, and an asset moved elsewhere keeps its place.

Checks:
- `npx vitest run --maxWorkers=1 apps/draw/src/surfaces/assetSurfaces.test.tsx`: pass (13/13). The new test failed before the fix.
- `npx vitest run --maxWorkers=1 apps/draw/src/surfaces/chromeToggles.test.tsx`: pass (4/4).
- `npm run checks:gate`: pass, "checks:gate: all 33 passed". This includes the root `npm run lint`; apps/draw has no workspace lint of its own.
- Tree clean apart from `.skulkr/`.

tally: 2 of 2 fixed, 0 extra fixed