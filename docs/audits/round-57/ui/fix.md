- Fixed overlay inside a size container (`container-type`) or a `content-visibility` ancestor was placed as if its block were the viewport, and `visibleRegion` missed the clip (B): fixed 672823ce92
- `wrapLine` gave the mirrored drop gap for right-to-left wrapped chips (B): fixed c3660c2b30
- Scroll-spy snapped back from a last section that cannot reach the top, and scrolling to the bottom never marked it (B): fixed f997a6f72c. `pickActiveSection` gained an optional third argument, so this changeset is `minor` (`fix api`).
- `createDomFocusScope().tabOrder()` listed elements under `display: none` or `visibility: hidden` (B): fixed 19c07954d7
- `useIdleSettle` still committed after it was turned off mid-wait (B): fixed cb65353ce7
- `useEditDraft` brought back an abandoned draft when the value returned to where the edit began (B): fixed 56ea2c70ef. The draft is now dropped when the value moves, not just hidden.

A.md was empty (0 bytes), so all six findings come from B. Each fix has its own test, which I saw fail before the fix, and its own changeset.

Checks:
- New or changed tests, one file at a time with `--maxWorkers=1`: `blockFrame.test.ts` 6 passed, `wrapLine.test.ts` 2 passed, `useScrollSpy.test.tsx` 12 passed, `createDomFocusScope.test.ts` 10 passed, `useIdleSettle.test.tsx` 2 passed, `useEditDraft.test.ts` 3 passed.
- Other affected tests: `createDomFocusScope.pbt.test.ts` 3 passed, `TokenField.test.tsx` 17 passed, and the 80 test files of the components that use `useEditDraft` (Slider, InlineRange, OpacityRange, Properties, ActionEdit, GradientEditor, and MeshEditor): 663 passed.
- Unrun: `TokenField.browser.test.tsx` and `overlayTheme.browser.test.tsx`, which need a real browser.
- `npm run checks:gate`: all 32 passed. The first run failed on `check:changesets` (three titles over 140 characters, and the scroll-spy one marked `patch` instead of `minor`); I fixed those inside their own commits and the rerun passed.
- `npm run lint -w @weasel-js/ui` failed because the package has no `lint` script. `npx eslint packages/ui/src` passed (exit 0).
- The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed