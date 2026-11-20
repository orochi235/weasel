- useOpenKeymap hint goes stale on overrides or action changes (A+B): fixed 5d1495bf44
- captureGesture ignores a pen eraser press (A): fixed 348df8af40
- createKeymapContribution's Escape guard misses a keyHeld Escape (A): fixed b3eab9d2ad
- a capture settled mid-press lets the release and click reach the page, including the macOS right-click case (A+B): fixed f435fe6351
- captureGesture can't capture a middle or secondary drag (B): fixed 348df8af40, in the same change as the eraser fix (both are about the press's button)
- describeKeymap drops a key bound with Ctrl or Meta (B): fixed f8524f2c54. The row now reads in words, like `Control-1`, because the shortcut chip has no field for Ctrl or Meta
- a key in the double-click window discards the pending click (B): fixed 9343d9bfe2. This needed a behavior call nobody had made, so I made it: a key other than Escape settles on the pending click and is left to the page, and Escape still resolves `null`. It is recorded in `docs/unruled.md`.

Extra, found while fixing:
- the end of one capture's release guard could remove a later capture's guard, because they all used the same `take` listener: fixed f435fe6351 (each guard now has its own listener)

Checks:
- `npx vitest run --maxWorkers=1 packages/routing/src/keymaps/createKeymapContribution.test.tsx`: pass (13 passed)
- `npx vitest run --maxWorkers=1 packages/routing/src/keymaps/describeKeymap.test.ts`: pass (7 passed)
- `npx vitest run --maxWorkers=1 packages/routing/src/keymaps/useOpenKeymap.test.tsx` (new file): pass (1 passed)
- `npx vitest run --maxWorkers=1 packages/routing/src/keymaps/captureGesture.test.ts`: pass (15 passed)
- Each new test failed against the code before its fix.
- `npm run checks:gate`: pass (`checks:gate: all 32 passed`). The first run failed `check:changesets` on titles over 140 characters; I shortened them and folded each into its own commit.
- `npm run lint -w @weasel-js/routing`: not run, because the package has no lint script (npm reports a missing script). In its place `npx eslint packages/routing/src/keymaps`: pass (exit 0).
- `npm run check:size`: pass
- Tree clean.

tally: 7 of 9 fixed, 1 extra fixed