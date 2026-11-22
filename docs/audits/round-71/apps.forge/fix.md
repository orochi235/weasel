Stale-key check (A+B): fixed 2579173a2b. The suite now fails when a KNOWN, JUDGED, or UNSWEPT entry names a story file the glob no longer finds. The glob and its key function moved into `apps/forge/a11y.files.ts`, and JUDGED moved into `a11y.known.ts`.

UNSWEPT entries never retried (A): fixed 7d1f9c6f33. Each UNSWEPT file is rendered again, and the test fails once none of its stories fault, so a fixed story stops being skipped for good.

[r70-1] followScheme listener never unsubscribed (carried): not a defect (no longer applies). `followScheme` now has `dispose`, stops watching the OS once it follows no root, and `forge.frame.tsx` calls `dispose` on HMR dispose.

[r70-3] labkit stories drop the Theme and Density globals (carried): fixed 436099408e. The new test reproduced it, reading `interstellar` where `win9x` was asked for. The frame now wraps `LabRoot` in a `ThemeProvider` set to the trial's theme, density, and resolved mode, through a new `trialChoice` in `themes.ts` that `applyTrialTheme` also uses.

[r70-4] a11y sweep titles stories from their directory (carried): fixed e034c9a71f. `titleOf` reads the meta's own title, as the workshop's indexer does, and throws for a meta that names none. Every ui and labkit story file names one today.

[r70-6] Weight default hidden by the default font (carried): fixed e774608bc3. Oswald ships 200, 300, and 400, so the default is now `400`, `fontRule`'s fallback matches, and a test checks that every font global's default is a value the default font offers.

None of these needed a changeset: `apps/forge` has no `package.json`, so it is not a published package. No call needed recording in `docs/unruled.md`. The strict throw in `titleOf` doesn't change behavior today, since every story file names a title.

The r70-3 fix could change browser sweep results. Labkit stories in the sweep now render in the default `weasel` theme instead of `interstellar`, so their color-contrast results may differ: new violations, or contrast entries in KNOWN that no longer fire. I couldn't run the browser sweep here.

Checks:
- `npx vitest run --maxWorkers=1 apps/forge/a11y.files.test.ts`: pass (5)
- `npx vitest run --maxWorkers=1 apps/forge/fonts.test.ts`: pass (19)
- `npx vitest run --maxWorkers=1 apps/forge/fonts.pbt.test.ts`: pass (3)
- `npx vitest run --maxWorkers=1 apps/forge/forge.frame.test.tsx`: pass (1)
- `npx vitest run --maxWorkers=1 apps/forge/themes.test.ts`: pass (3)
- `npx vitest run --maxWorkers=1 apps/forge/mode.test.tsx`: pass (8)
- `npx vitest run --maxWorkers=1 apps/forge/devtools.test.tsx`: pass (2)
- `apps/forge/a11y.*.browser.test.tsx`, through the edited `a11y.suite.tsx`: unrun (browser)
- `npm run checks:gate`: pass (all 33)
- `npm run lint -w <pkg>`: not applicable, `apps/forge` is not a workspace package; the root `npm run lint` passed inside the gate

The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed