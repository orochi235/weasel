Dispatch tab's cap counted hidden unhandled records, so idle pointer moves evicted the handled ones the default filter shows (A): fixed 82fcc66709

DispatchView and HistoryView kept their records and switches when the follower changed, so a new client delivered the ring again as duplicate rows (B): fixed f7ed9871cd. The fix covers both views: they start over with the switches off.

A history step's Ops count and Entries list were cut at 50 entries with no sign of the cut (B): fixed dd6a661dc9. The record now carries `entryCount` and `opCount` totals, and the Entries column and the step's detail show "… N more".

The input line and the route strip ordered a modifier chord differently (B): fixed 9c4e0bf12c. Both now use one order from the new `views/modLegends.ts`, and the input's platform mod key is named `mod`.

RegistryBrowser's narrow layout only worked inside DevtoolsPanel, because it relied on the panel's container (B): fixed f6c4d0bc54. A wrapper now declares its own container. I checked the other `@container` rule, in SceneView, and it needs no change because SceneView is only ever mounted inside the panel.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: DispatchView.test.tsx pass (7), HistoryView.test.tsx pass (10), FallthroughDiagram.test.tsx pass (25), GestureRoute.test.tsx pass (9), RegistryBrowser.test.tsx pass (20), TraceTable.test.tsx pass (1), page/history.test.ts pass (5), page/canvas.test.tsx pass (12), page/session.test.ts pass (14), DevtoolsPanel.registry.test.tsx pass (5).
- RegistryBrowser.browser.test.tsx (new): unrun, since browser tests can't run here.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/devtools`: the package has no `lint` script ("Missing script: lint"). `npx eslint packages/devtools/src` passed, exit 0, and the gate's root `npm run lint` passed.
- `npm run check:changesets`: pass, after I shortened three changeset titles that were over 140 characters.
- typecheck:packages devtools: "1/1 devtools ok".

tally: 5 of 5 fixed, 0 extra fixed