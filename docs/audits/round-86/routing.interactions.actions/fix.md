Plain run writes session params, masking a later `under` tuning value (A): fixed de57473295. Since only an adjust writes session params now, this also removes the plain-run case of B's `handle.params()` finding.

UI-begun gesture's last operation ignores `ctx.params` (A): fixed 2d23403665. The reviewer was partly wrong: `begin` also passes its params as `opts.params`, so the start's values were already included. Each `update`'s params were what got dropped, so the panel and the replay used the start's values. Now the last update's params are laid in.

Adjusting a gesture replays it after its action is unregistered, muted or refused (A): fixed 9632b5337b. `LastOperationHost` gets a new `admits(id, params)`, and both the immediate and the gesture paths use it.

Tuning params reach `start` but not the `onMove` each `update` drives (B): fixed 57f28f340c.

A gesture's `handle.params()` values become session params for every later run (B): duplicate of the first finding (A), fixed by de57473295.

The dev deps Proxy throws on introspection reads such as `toJSON`, `$$typeof` and `asymmetricMatch` (B): fixed def1c12928.

`withRoleMods` widens a binding for a role whose declared keys are empty (B): fixed f632da4044. That was a judgment call, recorded in `docs/unruled.md` (606e167627).

`'&'`-channel phase validation covers only `defaultBinding` (B): fixed 02274cbef4. `tune` now throws, as `register` does. An override that substitutes one leaves that binding unbound and warns once, the same way an override that isn't a valid route is skipped. That call is recorded in `docs/unruled.md`, along with the one on session params.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: `lastOperation.test.tsx` 24 passed, `lastOperation.ongoing.test.tsx` 18 passed, `tuning.test.tsx` 16 passed, `modifierRoles.test.ts` 2 passed, `buildDeps.test.ts` 2 passed, `bindingOverrides.test.ts` 13 passed. No browser test files touched.
- `npx vitest run --maxWorkers=1 packages/routing`: 194 files, 1322 tests passed.
- Other packages' last-operation tests (ui `LastOperationPanel`, editing `SceneCanvas.toolStyle`, text-tools `stickyStyle`, path-tools `effectForms.lastOperation` and `reachToMeet.lastOperation`): all pass.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/routing`: routing has no lint script ("Missing script"); the root `npm run lint` inside the gate passed.
- `npm run check:changesets`: OK, with no warnings on this round's changesets.

The tree is clean apart from `.skulkr/`.

tally: 7 of 8 fixed, 0 extra fixed