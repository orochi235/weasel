[A+B] `<kbd>` span ends at the first `<` instead of at `</kbd>`, so `<kbd>Mod+<</kbd>` never reads as keys (B): fixed 3f997736b7
[A+B] `<kbd>` span not kept whole inside a mark or a link label, so a `]` or `*` in it closes the mark (A): fixed d39c088e93 (both fixes share one `kbdEnd` helper, split into two commits)
[B] useFloatingPlacement never measures a panel or container element that mounts or changes after the first commit (B): fixed b3dfabc0d2
[B] InlineRange fill drawn at the raw `value` while the thumb sits at the step-snapped value (B): fixed b0050106bd (also handles a `max` off the grid and `step="any"`)

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/InlineMarkdown/parseInline.test.ts`: pass (the whole InlineMarkdown directory, 29 tests including the pbt file, also passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/InlineRange/InlineRange.test.tsx`: pass (15); `InlineRange.edit.test.tsx`: pass (15); `InlineRange.skin.test.tsx`: pass (7)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/FloatingPanel/useFloatingPlacement.test.tsx`: pass (39); `FloatingPanel.test.tsx`: pass (14)
- Each new test was confirmed failing against the frozen source before its fix.
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). An earlier run failed on lint (`react-hooks` rules) and on a changeset title over 140 characters; both were fixed and the commit amended.
- `npm run lint -w @weasel-js/ui`: not applicable, because the package has no `lint` script ("Missing script: \"lint\""). The root `npm run lint` inside the gate passed.
- Unrun: `InlineRange.marks.browser.test.tsx` (browser test, not touched).
- The tree is clean.

tally: 4 of 4 fixed, 0 extra fixed