Teardown redraw: teardown stopped watching the dispatchers before canceling their gestures, so the overlay stayed painted (A): fixed b43927c483

Keyup stopped by a widget left held-key gestures and keymap leaders engaged (A): fixed e80442ab0a

Modifier-key hover ran on the last-routed view, not the one under the pointer (A): fixed 8eaa1f9dc8

`gestures.keymapUnbound` was read only when the host rendered (B): fixed 8acddbf9b9

Drop preview lacked the `viewId` and modifier `roles` the drop itself gets (B): fixed 11ca7ebee5. `ResolveOnlyResult` now carries `binding`, the same as `ResolvedCandidate`; that is new API, with its own `minor` changeset.

Unbound OS drop still had its default prevented (B): fixed ea13426848

A dispatcher swapped in or newly registered was not watched for redraws (B): fixed 080174adaa. The `views` option (`@internal`) gains `subscribe`, and SceneCanvas passes its view registry's.

Extra, fixed in ea13426848 with the drop fix: `itemTypesFromDataTransfer` had no fallback to `dt.files`, which `itemsFromDataTransfer` has. Gating the drop on a winner would otherwise have refused a source that has files but no items. This broke `sceneCanvas.ingestion.test.tsx` until fixed, and now has its own test in `ingestItems.test.ts`. I also updated `useGestureDispatcher.dropView.test.tsx`: it dispatched a drop that nothing bound, so it now registers a drop action.

Checks:
- Each new test failed before its fix (7 failed, before any fix was applied).
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: `checks:gate: all 33 passed`. An earlier run on an unfinished tip failed 3 of 33 (check:listener-sets, check:size and lint); all three are fixed in the commits above.
- `npm run check:changesets`: `[changesets] OK`
- `npm run lint -w <pkg>`: not run. Neither `@weasel-js/routing` nor `@weasel-js/core` has a `lint` script. eslint on every changed file passes.
- `npx vitest run --maxWorkers=1`, one file at a time: keyScope 25 passed, redraw 7 passed, hover 19 passed, kitSettings 7 passed, ingest 13 passed, dropView 1 passed, dropPreview 6 passed, ingestItems 2 passed. These related files also pass: `sceneCanvas.ingestion` (28), the resolveOnly users in core and editing (172 together), `useGestureDispatcher.nested` and `useGestureDispatcher.dispatcherOption`.
- Tree clean.

tally: 7 of 7 fixed, 1 extra fixed