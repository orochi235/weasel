Backward-at-start play (A+B): fixed a863ce8a61 — Play on a run played backward to its start now seeks to the run's end and plays backward.

Backward replay that keyed on `ended` and always played forward (B): fixed a863ce8a61 — `replay` plays the way Play does and keeps the held direction. The call is recorded in `docs/unruled.md`.

Speed the transport held not following a redeclared clock speed (A): fixed b367c316d7 — the hold takes each declared speed until a transport sets a speed. The call is recorded in `docs/unruled.md`.

Rate-only config edit not redeclaring (A+B): fixed da9637354c — `shape` now keys on the speed `declare` takes. That rule is exported from `@weasel-js/clock` as `declaredSpeed` (minor changeset).

HeldClock's forced `rate: 0` resetting a rate-derived speed, and `sameDeclaration` skipping rate (A): fixed f6d2723cd4.

`useLabClocks` recording against the latest `spec` (A): fixed 5225f0eacc — it records against the spec the clock was opened from. The inline-literal resubscription goes with it.

`replay` doing nothing for a clock that isn't seekable (A): fixed a863ce8a61 — Play and `replay` reset an ended clock that isn't seekable and play it from the start. The call is recorded in `docs/unruled.md`.

Keyed transport answering page keys when no trial is focused (B): not a defect — `useFocusPick` makes `focusedTrialId` fall back to `trialIds[0]`, so in a lab with trials it is never null, and B's case of two trials with none focused can't occur.

Extra: `check:numeric` failed at the frozen tree on `apps/draw/src/dev/audits/Treemap.module.css` (raw `tabular-nums`): fixed 6008bd78b5.

Extra: the labkit lint's design-token check failed at the frozen tree on raw px fallbacks inside `font-size` in `packages/ui/src/components/SpanStrip/SpanStrip.module.css`: fixed 5f1729d8ee. The line-box calc moved into a custom property and rendering is unchanged.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `TrialTransport.test.tsx` pass (21)
  - `configClock.test.tsx` pass (11)
  - `HeldClock.test.tsx` pass (6)
  - `transportHold.test.ts` pass (3)
  - `useLabClocks.test.tsx` pass (1)
  - `transportControl.test.ts` pass (3)
  - `transportControl.pbt.test.ts` pass (1)
  - `packages/clock/src/declare.test.ts` pass (23)
  - `packages/clock/src/clock.test.ts` pass (56)
  - `packages/ui/src/components/SpanStrip/SpanStrip.test.tsx` pass (15)
- Each new test failed against the pre-fix source.
- `npm run checks:gate`: pass (all 32 passed).
- `npm run lint -w @weasel-js/labkit`: pass.
- `@weasel-js/clock` and `@weasel-js/ui` have no `lint` script. eslint on every changed `.ts`/`.tsx` file: pass.
- `npm run check:changesets`: pass.
- Unrun: none (no browser test touched).

tally: 6 of 9 fixed, 2 extra fixed