Menu host under `<Yoke>` resolves against the tree root's active scope, not the yoke's (A): fixed cd67467986

Canvas's `ownActions` ignores an ancestor mute (B): not a defect. The premise is wrong: `list()`/`resolve` also stop at the canvas's own registration before they reach the ancestor's mute, so `ownActions` agrees with `list`. Whether a scope below a `mute` may re-register the muted id is listed as open in `docs/unruled.md`.

An action without `requires` gets the legacy dep bag from `trigger` and an empty bag from the dispatcher (B): fixed 8108cae06d. This was a behavior call: every path now uses `createActionDeps`, which means requires only. It is recorded in `docs/unruled.md`, and core's `registry.test.tsx` now declares `requires: ['selection']`.

An unparsed binding override warns again on every tree change (B): fixed b28dd89ba0. It now warns once per id and error through `createWarnOnce`, and only in dev, as that helper does.

Checks:
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed `typecheck`, `typecheck:packages` (routing) and `check:part-caches`. I fixed the test's typing, added an allowlist entry for menuHost's store WeakMap, and squashed both fixes into their commits.
- `npm run lint -w @weasel-js/routing` and `-w @weasel-js/core`: fail with `Missing script: "lint"`, because neither package has one. eslint on every touched file passed, and so did the gate's root `npm run lint`.
- Run one at a time with `--maxWorkers=1`, all pass: menuHost.scope.test.ts 2/2, bindingOverrides.test.ts 14/14, trigger.test.ts 4/4, core registry.test.tsx 15/15, menus/menuHost.test.ts 13/13, eligibleOutsideDispatch.test.ts 5/5.
- Extra run of packages/routing, core and editing (`--maxWorkers=6`): 9790/9791 passed. The one failure was core's registry.test.tsx relying on the legacy bag, now updated.

tally: 3 of 4 fixed, 0 extra fixed