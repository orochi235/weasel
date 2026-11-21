- ListEditor's Enter does not commit the draft at `maxItems` or with no entry kind (A+B): fixed 2b3906e46a, with a follow-up 869d6b1385 that keeps the function under the size cap.
- MeshHandles ignores Disabled and ReadOnly scopes (A): fixed fe296cc742. The shared `HandleOverlay` now takes the control's hold and gates every point's edits by it, and `MeshHandles` takes hold props. The changeset title was shortened in 15525b2569.
- PageTabs draws its drop line on the wrong edge in RTL (A): fixed 30b28d2031.
- OpacityRange's dead-track style misses a range disabled for a reason (A+B): fixed 0d41c24fdf.
- MeshHandles remounts and welds a point moved onto another (A): fixed 4338407160 and ed201b52ac. In the renderer, `meshHandles` no longer merges two points of the same patch. In ui, MeshHandles settles which points are one handle when a gesture starts and keeps that until it ends. A point landing on another patch's point still becomes one handle once the drag ends, because that is `meshHandles`' rule for shared seams.
- Jog's Pause is disabled while playing once `count` drops below 2 (A+B): fixed 3292f0507b.
- Jog drops a falsy caption such as `0` (A): fixed 9092a9e61a. JogAlong reads the same part, so the curved layout already agreed with the straight one; both now draw a `0`.
- LastOperationPanel calls `store.dismiss` unbound (A): fixed bac72452c1.
- A `current` MenuButton is not held by a ReadOnly scope (A): fixed b1cfa65790.
- Legend's dot swatch is offset on the wrong side in RTL (A): fixed 21016284ed.
- KeymapHint story ignores its `label` control after the first render (A): fixed b58c9c762c. Stories don't ship, so there is no changeset.
- A bare MenuButton disabled for a reason is drawn enabled (B): fixed 5ee9592312.

Extra defects:
- GradientHandles ignored Disabled and ReadOnly scopes, the same mistake as MeshHandles through the same overlay (sweep): fixed fe296cc742. It now takes `disabled`, `disabledReason`, `readOnly` and `readOnlyReason`, so its changeset is `minor` and tagged `fix api`.
- `useLastOperation` in `@weasel-js/routing` passed `store.get` and `store.subscribe` to `useSyncExternalStore` unbound, so a store written as a class broke there too (sweep): fixed bac72452c1.

81b030ad00 only fixes a type cast in a new test (TS2352), which the first gate run caught.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: pass. That is renderer `handles.test.ts`, plus `GradientHandles.hold`, `Jog`, `KeymapHint.stories`, `LastOperationPanel`, `Legend`, `ListEditor.draft`, `MenuButton.held`, `MeshHandles.hold`, `MeshHandles`, `OpacityRange` and `PageTabs`. Each new test was also seen failing against the unfixed source.
- `npm run checks:gate`, first run: fail, 3 of 32 (`typecheck` and `typecheck:packages` on TS2352 in a new test, and `check:size` with the ListEditor function at 122 lines). Both were fixed.
- `npm run checks:gate`, rerun: pass, "all 32 passed".
- `npm run lint -w <pkg>` for ui, routing and renderer: not run, because none of the three has a `lint` script ("Missing script: lint"). The root `npm run lint` inside the gate passed and covers `packages/`.
- `npm run check:changesets`: pass, "OK — 3099 changeset(s)".
- Browser tests: none touched.
- Tree is clean; `.skulkr/` is untouched.

tally: 15 of 15 fixed, 2 extra fixed