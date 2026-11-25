All 14 findings are fixed, as ten commits with one changeset each. One of them is a judgment call, now recorded in `docs/unruled.md`.

- values source reset ignores `over`, so an alias row's Reset does nothing (A+B): fixed 1fcd17655e. This adds an optional `PrefsSource.over`, so it is a `minor` changeset.
- writing `undefined` to a split pref wipes every option and drops `at` (A): fixed 17f50a6f21
- an auto-capable enum is accepted as a selector and holds `undefined` while auto (A+B): fixed 45172aa31a. My call, recorded in `docs/unruled.md` under round fifty-three: such a selector is refused with code `auto` unless its `auto.value` is one of its options. The alternative was to read its auto as its default.
- `unitScopedPrefUnit` loses its scale to a large offset (A): fixed bccbbfe1c9
- `createDefaultsSource` reads a leaf that starts auto at its `default` (A+B): fixed b3599704d5. It now reads through the same function a store uses.
- a write at one option of a split auto leaf rebuilds from `defaultScope` (A): fixed 269d74d183
- `setAuto(false)` pins a split leaf that is auto only under the current option (B): fixed 269d74d183. It has the same cause as the finding above, so one fix covers both.
- a split color holding names or `rgb()`/`hsl()` strings snaps to its heaviest member instead of mixing (B): fixed 05ae730cc8
- a store from `usePrefsStore` still writes to storage and the other stores after `close` (B): fixed fc1fc9b6e6
- an enum option that is a CSS-wide keyword is written bare by `prefsCss` (B): fixed 7e5c30d2bb
- `prefNodeAt` finds a nested section by its key, and `resetPlans` builds paths no leaf has (B): fixed 6cd45dab16

No extra defects found.

Checks:
- Each touched test file, alone with `--maxWorkers=1`: pass. The files are `sources/sources.test.ts`, `store.scope.test.ts`, `splitCheck.test.ts`, `splitCheck.pbt.test.ts`, `scopedUnit.test.ts`, `defaultsSource.test.ts`, `store.auto.test.ts`, `blend.test.ts`, `usePrefsStore.test.tsx`, `css.test.ts` and `resetPlan.test.ts`. Each new test was also seen failing against the old source.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/prefs`: not run, because the package has no `lint` script ("Missing script: \"lint\""). `npx eslint packages/prefs/src` passed with no findings.
- `npm run check:changesets`: pass, "OK — 2547 changeset(s)".
- The working tree is clean.

tally: 14 of 14 fixed, 0 extra fixed