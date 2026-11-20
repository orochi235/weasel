Live-lens copy unchecking the story's checked radio, and re-running iframe loads and autoplay (A): fixed 24c4cc0c38

Follow lens zoomed while the pointer rests keeps the old reticle size, and pinning commits it (A): fixed 386c573145

Loupe `mode`, `factor` bounds read once at mount, later prop changes dropped (A): fixed e20244966f

`createLensApi` restarting ids at `lens-0` and colliding with lenses already in a host-owned scene (A): fixed 3423cc8a9a

`createLensApi` subscribing to the scene and never unsubscribing (A): fixed 0885a91616. It now subscribes only while a Follow lens is held.

Turning `hollow` off leaves the last hollow box's tiles undamaged (A): fixed 31668e3491

Loupe `mode`, `minFactor`, `maxFactor` read once at mount (B): duplicate of A's mode/bounds finding, fixed e20244966f

Lens API places lenses in lab-body px while the overlay draws them in surface-container px (B): fixed 753f595ab4. `createLensApi` takes a `frame` ref and `useLabBody` returns `frameRef`; `ForgeLoupe` now passes it, and passes it to `lensClient`.

Hollow lens damage keeping its last box in client px, so a scroll invalidates the wrong region (B): fixed 4e5e193d51

Extra: gate `check:numeric` failed on the frozen tree at `apps/draw/src/dev/audits/Treemap.module.css` (raw `tabular-nums`) (sweep): fixed 3026ec81e7

Extra: gate `lint -w @weasel-js/labkit` design-token check failed on the frozen tree at `packages/ui/src/components/SpanStrip/SpanStrip.module.css` (raw px inside `font-size`) (sweep): fixed f5c874c3cd. No changeset, since nothing renders differently.

Checks:
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/useLoupe.test.tsx`: pass (38)
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/lens/lensApi.test.tsx`: pass (15)
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/useLensDamage.test.tsx` (new file): pass (2)
- `npx vitest run --maxWorkers=1 packages/labkit/src/loupe/lens/cloneSource.test.ts`: pass (10)
- Also run after the lens API changes: `lensActionDefs.test.ts` pass (16), `LensActions.test.tsx` pass (8), `lensScene.test.ts` pass (15), `packages/forge/src/shell/loupe/CompareMenu.test.ts` pass (8)
- Each new test was confirmed to fail with its fix reverted.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/labkit`: pass
- `npm run lint -w @weasel-js/ui` and `-w @weasel-js/forge`: those packages have no `lint` script ("Missing script: lint"); the root `npm run lint` passes.
- `npm run check:changesets`: pass, "OK — 2404 changeset(s)"
- Unrun: no `*.browser.test.*` file was touched.
- The tree is clean, with no stashes.

tally: 9 of 9 fixed, 2 extra fixed