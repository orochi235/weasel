Area `ui.components.Button`: all of the findings are fixed, in 10 commits on top of the frozen tree.

- Close preset's 16px glyph drawn at 12px by the size rule (A): fixed e4b977f905. The size rule is the design: `measureButton` and the theme hook's docs both say 12px at sm, and `--wzl-button-icon-size` overrides it. So I removed the `size={16}` that never took effect rather than restoring the 16px glyph the old `CloseButton` drew. Restoring 16px would be a visual call.
- `domButton.measure` gives `md` while draw takes the `ControlSizeScope` size (A): fixed b499b39eb5. This was a judgment call, recorded in `docs/unruled.md`: an unsized `domButton` draws at `md` on both sides, because measure can't read React context.
- `domButton.measure` ignores `variant: 'link'` (A): fixed fa2f7adaf7. Also a judgment call recorded in `docs/unruled.md`: measure throws on a link, since no token names the font around it.
- Lab "Export deltas" compares against the lab's own defaults, not what ships (A): fixed e24d01c5f6.
- Read-only toggle still shows hover, press and a pointer cursor (A): fixed 6847c24b5d.
- Pressed confirm button loses its accent body (A): fixed 5171b535ee.
- Lab's held hover sample always shows confirm's hover (A): fixed ee5c749405. The solid, confirm and ghost hovers are now one custom property each, read by both the `:hover` rules and the lab.
- Falsy label (`null`, `false`, `''`) still makes a label part (A): fixed 772bdab2f9.
- Story `size` control omits `xs` (A): fixed 992ee4a32a.
- Measure/draw size mismatch inside a scope (B): duplicate of A's `domButton.measure` scope finding.
- Export compares against lab defaults (B): duplicate of A's export finding.
- Exported shape deltas lose to `.size_*`, and the accent overrides the theme (B): fixed e24d01c5f6. The shape now exports through the button hooks (`--wzl-button-h` and the rest), and the accent is preview-only.
- 360° inset angle exports `-0.00px` (B): fixed e24d01c5f6, folded into the same lab rewrite rather than a commit of its own.
- Lab hover preview shows confirm's hover for every variant (B): duplicate of A's hover-sample finding.
- Falsy label gets a label slot and a gap (B): duplicate of A's falsy-label finding.
- RovingToolbar story's tab stop doesn't follow clicks or focus (B): fixed 4b7b737127.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/measureContract.test.tsx`: pass (9)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Button/closeButtonProps.test.tsx`: pass (5)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Button/Button.native.test.tsx`: pass (10)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Button/Button.test.tsx`: pass (31)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Button/lab/buttonLabConfig.test.ts`: pass (5)
- `packages/ui/src/components/Button/Button.states.browser.test.tsx`: unrun (browser test)
- `packages/ui/src/components/Button/lab/ButtonLabView.browser.test.tsx`: unrun (browser test)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/ui`: unrun, the package has no `lint` script ("Missing script: lint"). In its place, `npx eslint` on every changed `.ts`/`.tsx` file: pass (exit 0)
- `npm run check:changesets`: pass ("OK — 2719 changeset(s)")
- Tree is clean.

tally: 16 of 16 fixed, 0 extra fixed