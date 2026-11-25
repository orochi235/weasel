[r42-1] `resolveSpatialReference` accepts NaN and Infinity (carried): fixed d21ceee7fb

[r42-2] `useNotices` throws outside a `<DepRegistryProvider>` (carried): fixed 7f72baa0bf. The fix adds `useOptionalDepSource` to `@weasel-js/routing`, which publishes a dep and does nothing when no provider is in scope. Core's barrel also exports it.

[r42-3] `resolvePreviews` lists a previewed node twice when an unpreviewed container sits between it and a previewed frame (carried): fixed c97d5f8fc1

[r42-4] `insertExtrasFromPlane` rewrites a consumer insert kind's extras (carried): fixed e7569e29c2. It now maps extras only for the kit's own kinds (`line`, `polygon`, `star` and `pencil`), and only fields that are real points.

[r42-5] `translateTargets` drops a group's children under `IDENTITY_POSE_COMPOSITION` (carried): not a defect. Under the identity composition a container carries nothing, and `packages/editing/src/actions/move/move.carried.test.ts` ("writes only the container under the identity strategy, whose containers carry nothing") pins exactly this. Commit b337d8d866 removed the identity branch on purpose. I tried the fix, that test failed, and I reverted it.

[r42-6] `actionReferenceSources` answers `'pointer'` in the camera's world and `{ node }` in that node's own plane, while align and flip apply it in another plane (carried): fixed 9e21b5dd8c. `actionReferenceSources` takes an optional `plane: { view, layer }`. Align and flip pass the selection's layer, the same choice `selectionLayer` makes.

Extra: `useBooleansAdapter` threw outside a `<DepRegistryProvider>`, though its doc says it silently does nothing there (sweep). Fixed 76475a3178.

Extra commit 4ed5770610 shortens two changeset titles from the commits above that `check:changesets` refused. It is not a separate defect.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own:
  - `spatialReference.test.ts`: pass (7)
  - `useNotices.test.tsx`: pass (2)
  - `depRegistry.test.tsx`: pass (6)
  - `useBooleansAdapter.test.tsx`: pass (1)
  - `resolvePreviews.test.ts`: pass (15)
  - `scrollView.test.ts`: pass (10)
  - `planeInput.extras.test.ts`: pass (3)
  - editing `planeInput.test.ts`: pass (24)
  - `move.carried.test.ts`: pass (10) after the revert
  - align: `action.test.ts` pass (29), `align.stroke.test.ts` pass (3), `align.translateSources.test.ts` pass (3)
  - flip: `flip.frame.test.ts` pass (3), `flip.test.ts` pass (27), `helpers.test.ts` pass (3)
- `npm run checks:gate`: pass, "all 32 passed" (the first run failed `check:changesets` on title length; fixed and rerun).
- `npm run lint -w` for routing, core and editing: not run, because none of the three packages has a `lint` script. Instead, `npx eslint` on every changed `.ts`/`.tsx` file: pass (exit 0).
- Tree clean.

tally: 5 of 6 fixed, 1 extra fixed