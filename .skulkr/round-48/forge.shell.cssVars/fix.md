Saving from trial A while trial B is focused (A+B): fixed 3a32066fdf. The panel now gives each trial its own instance, so an unfinished save clears the saved edits from A and leaves B's edits and Save button alone. The filter and tab stay put when you switch trials.
An edit made while a save is in flight was thrown away when the save finished (A+B): fixed f773df0dbd. The save now drops only overrides still holding the value it saved, and scale edits equal to the one it saved.
A scale edit outlived its steps' overrides and was later shown and saved (A): fixed 20bb484709. Every commit and reset now drops a scale edit once none of its steps is overridden.
Jumping and reading found the panel through two different lookups (A): fixed 17efa6f395.
A picked section stayed lit after scrolling with the scrollbar (A), or after `scrollIntoView` from a token link (B): fixed 71f91edc3a. The hold now ends once the list moves from where the jump left it.
History opened once per trial, so another tab's steps were overwritten and later reverted by undo (B): fixed 829629cf49. The history is opened again from the store whenever another view writes it.
Commits in one tick were not one step when `history.coalesceMs` is 0 (B): fixed c42695792a.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/forge/src/shell/cssVars/useVarsEdits.test.tsx`: pass (4 passed)
- `npx vitest run --maxWorkers=1 packages/forge/src/shell/cssVars/CssVarsPanel.test.tsx`: pass (20 passed)
- `npx vitest run --maxWorkers=1 packages/forge/src/shell/cssVars/SectionJump.test.tsx`: pass (2 passed)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script. The root `npm run lint` passed inside the gate.
- `npm run typecheck:packages -- forge`: pass ("1/1 forge ok")

tally: 7 of 10 fixed, 0 extra fixed