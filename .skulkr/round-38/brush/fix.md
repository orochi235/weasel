README example makes a new `share` object every render, so the brush tools are redefined every render (A+B): fixed 0e27031b8d. `shareBrushSize` now returns one cached, frozen share for each pair of size option and key, so the README example is correct as written. This is the general fix: I changed the helper itself rather than only the README, so anyone who calls it during a render gets a stable share.

No other defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/brush/src/brushSize.test.ts`: pass (4 passed). The new identity test failed before the fix.
- `npx eslint packages/brush/src/brushSize.ts packages/brush/src/brushSize.test.ts`: pass
- `npm run check:size`: pass ("sizes: no file or function grew past its cap.")
- `npm run check:changesets`: pass ("OK — 1731 changeset(s).")
- `npm run typecheck:packages -- brush`: unrun. A PreToolUse hook refused it here ("suite-sized npm script, and this is the controller") and said to send it to the fleet instead. The brief forbids fleet runs, so the batch run has to cover it.

The tree is clean.