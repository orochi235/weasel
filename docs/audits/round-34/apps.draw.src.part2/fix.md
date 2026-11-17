- Opacity scrub can't raise a selection whose paints are all at alpha 0, though the readout climbs (A+B): fixed d04096736f. This shares a commit with the next finding, because both come down to one scale-factor formula.
- One wheel notch down makes the dimmer nodes of a mixed selection more opaque (A): fixed d04096736f. Every node now scales by the target over the session's brightest alpha.
- A paint edit made while O is held is reverted by the next wheel turn (A+B): fixed 0705fc76b1.
- Recorded moves drop `pointerId`, so a two-pointer gesture replays as the wrong pointer (A+B): fixed 5f27c81e2b.
- A path effect inside a frame (a later page or a rigid group) exports at its frame-local coordinates (A): fixed 7f1cedf650. It now places through the same helper `booleanToObj` uses.
- Copy-as-SVG's viewBox is the geometric box, so strokes and markers are cut off and skipped roots take room (A): fixed b469d8a152. The selection is now fitted with `computeBounds`, which `@weasel-js/svg` now exports. That export has a `minor` `api` changeset.
- SVG import can mint an `svg-N` id that the file already carries, giving two drafts one id (A+B): fixed f031e06fd0.
- A replay outlives a detached canvas and can't be stopped (A+B): fixed 1e4d3801f8.
  - Question: pressing Play during a replay now stops it, and the action shows as active while a replay runs. That was my call; it is recorded in `docs/unruled.md` under round thirty-four.
- A recording that fails to save is dropped silently, with an unhandled rejection (B): fixed 0e5c51deda. `RecordingHost.failed` now takes `'play' | 'save'`.

Extra defects found while fixing:
- The recorder throttled moves on one shared clock, so in a two-finger gesture one pointer's moves could starve the other's: fixed 5f27c81e2b.
- Replay set `isPrimary: true` on every pointer: fixed 5f27c81e2b.

The draw fixes have no changesets because `apps/draw` has no `package.json`, so it isn't a package.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `computeScrubbedPaints.test.ts`: pass (9)
  - `useOpacityScrub.test.tsx`: pass (16)
  - `recorder.test.ts`: pass (21)
  - `replay.test.ts`: pass (8)
  - `recording/session.test.ts`: pass (10)
  - `pathEffects.test.ts`: pass (15)
  - `svgExport.test.ts`: pass (41)
  - `svgInterop.test.ts`: pass (41)
  - `svgBooleanGroup.test.ts`: pass (3)
  - `svgPages.test.ts`: pass (10)
- `npm run typecheck:packages -- svg`: pass ("1/1 svg ok").
- `npm run typecheck`: pass, no errors. It covers `apps/draw`, which `typecheck:packages` can't, because draw has no `packages/<name>/tsconfig.json`.
- eslint on the changed `.ts`/`.tsx` files: pass (exit 0, no output).
- `npm run check:size`: pass ("no file or function grew past its cap").
- `npm run check:changesets`: pass ("OK — 1355 changeset(s)").
- No `*.browser.test.*` file was touched. The tree is clean.