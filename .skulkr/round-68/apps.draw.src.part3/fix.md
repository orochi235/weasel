Simplify cancel leaves the slider and Sand's tolerance at the canceled value (A+B): not a defect. The Slider's edit protocol (`docs/conventions.md`, "Cancellation") sends the starting value to `onInput` before `onCancel`, so `onTolerance` puts the pref back. I ran it: the inputs were `[{tolerance:18}, {tolerance:1}]`, and the pref and `aria-valuenow` both ended at 1. Commit 32a0eb4b53 adds a test that pins this.

Offset cancel leaves the slider at the canceled distance (A+B): not a defect, for the same reason. `setDistance` gets the starting value back before `onCancel`, and the same test in 32a0eb4b53 covers it.

Reset (D) and toggle-none store the default paints in a different spelling from other color writes (A): fixed 8cfb4d78cd. `toggleNone`, `reset`, and the starting fill and stroke now all go through `toolOptionPaint`, and the starting pair is memoized so the callbacks don't change on every render. `apps/draw` is not a published package, so this fix has no changeset.

Checks:
- `npx vitest run --maxWorkers=1 apps/draw/src/tools/colorContext/ColorContextProvider.test.tsx`: pass (8/8); the other three colorContext test files: pass (3, 13, 8)
- `npx vitest run --maxWorkers=1 apps/draw/src/ui/PathCommands/PathCommands.test.tsx`: pass (7/7)
- eslint on the three touched files: pass
- `npm run checks:gate`: pass ("checks:gate: all 33 passed", root `npm run lint` among them)
- `npm run lint -w <pkg>`: not applicable, because `apps/draw` has no package manifest; root lint covers it

tally: 1 of 3 fixed, 0 extra fixed