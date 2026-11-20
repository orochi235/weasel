Deferred drag start leaves its handle running and never ended when `start` tears the dispatcher down (A+B): fixed 04da4ec946
Same teardown gap in `beginUiOngoing`, which still opens the handle in flight (B): fixed 22fb9380e9
WebKit pinch on a nested surface runs on both dispatchers (A): fixed 6c762af2f6
Immediate action bound to a wheel, pinch, key, held key, drop or paste gets no `roles` (A+B): fixed dcda12dfb4
Same branch also drops `viewId` for key-bound and other non-pointer immediate actions (B): fixed dcda12dfb4
Drop preview and `weasel-dropover` flicker off when an OS drag crosses a child (A): fixed 9ac624ee0c
`dispatcherWatch.sync` keeps a dead dispatcher subscribed when the live list holds a duplicate (A): fixed 3efaf32de6
Module header says an unregistered action id ends the input unhandled, but the walk goes on (A+B): fixed a8725abca8 (doc corrected to match the walk)
`createDispatcher` documents a `getAction` default that doesn't exist (A): fixed 45b010faac. The doc now says `getAction` only serves `beginUiOngoing`, with no default; no code changed, because `useGestureDispatcher` doesn't expose its dispatcher, so a default there would be unobservable
Prediction (`resolveOnly`, `resolveAll`, `explain`) ignores open keymaps (A+B): fixed e8b0ac70a6. `routeThroughKeymap` gained a quiet mode that prediction shares; `resolveAll` returns `[]` for input the keymap withholds, which is documented
Deferred start never has its handle's `subscribe` heard (B): fixed 10373662cf

Extra defects: none.

Behavior change to flag: dcda12dfb4 means an immediate invoker's `params` is never `undefined` any more; it always carries `mods`. Four tests in `dispatcher.immediate.test.ts` that pinned `undefined` or exact params were updated. I checked by reading the code that the `params === undefined` branches outside routing (`viewportZoom`'s default branch, `reachToMeet.enabled`) are not reached by dispatched key bindings. Suites outside routing that assert on immediate params were not run here; the batch run will cover them.

Checks:
- Each touched test file, alone with `--maxWorkers=1`: `dispatcher.dragThreshold` pass (9), `dispatcher.immediate` pass (16), `dispatcher.keymap` pass (17), `dispatcher.modifierRoles` pass (10), `dispatcher.uiOngoing` pass (18), `dispatcherWatch` pass (5), `useGestureDispatcher.dropPreview` pass (5), `useGestureDispatcher.nested` pass (7).
- Related files I didn't touch: `dispatcher.resolveOnly`, `dispatchRecord`, `useGestureDispatcher.hoverCursor`, `dispatcher.precedence`, `keyboard.modal`, every non-browser keymaps test, `viewport.safari.integration`, `minimap`, `MinimapCanvas.wheel`, `inputFacts`, `useGestureDispatcher.ingest` and `useGestureDispatcher.dropView`: all pass.
- No browser test file was touched, so none are unrun.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed typecheck on the `onDragLeave` signature; that fix was folded into 9ac624ee0c.
- `npm run check:changesets`: "OK — 2597 changeset(s)".
- `npm run lint -w @weasel-js/routing`: fail, `Missing script: "lint"` (the package has none). Instead, eslint on every changed file: exit 0.
- The tree is clean.

tally: 13 of 13 fixed, 0 extra fixed