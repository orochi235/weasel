Five fixes are committed, and the two reviewers' panel-placement findings were one defect. The gate passes.

- Menu-bar title gets the 16px end padding meant for a menu row's label (A): fixed d1b40c1a01
- Access letter not underlined when it starts a cluster of more than one code point, such as कि or 👍🏽 (A): fixed d6300d80bf
- Panel placed once at mount, so it overflows the viewport when a row widens it and the controller keeps a stale rect (A): fixed 5623a5adca
- Panel placed and sized once, so a row that grows pushes it past the viewport (B): duplicate of the A placement finding, fixed by 5623a5adca
- Text row's draft lost when the menu closes other than through useDismiss (B): fixed 1b2469cee4. The same gap was there for number rows (`UnitField` drafts), and the same commit fixes those. Blurring the field at teardown can't work, because React ignores DOM events during commit. Each value row now registers its draft with the open menu, which commits them before it disposes its controller.
- Silently opened trigger menu leaves focus on the body when dismissed while one of its fields has focus (B): fixed de31f29a47. useDismiss now blurs the field after `close` runs, not before.

Checks:
- `npx vitest run --maxWorkers=1` on each test file I touched: AccessLabel.test.tsx pass (8), MenuPanel.test.tsx pass (2), menuPanelCss.test.ts pass (6), MenuRow.values.test.tsx pass (29), useMenuTrigger.test.tsx pass (2).
- Related files, also run: ContextMenuHost.test.tsx pass (33), MenuRow.test.tsx pass (7), useContextMenu.test.tsx pass (3), MenuBar.test.tsx pass (25), menuBarKeys.test.tsx pass (13), MenuBar.defaults.test.tsx pass (2).
- Browser tests I didn't touch but that cover this code, unrun here: MenuTextValue.browser.test.tsx, ContextMenuHost.browser.test.tsx, MenuBar.browser.test.tsx.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed check:listener-sets on the draft registry; I switched it to `createEmitter` and folded that into 1b2469cee4.
- `npm run lint -w @weasel-js/ui`: fail, with `Missing script: "lint"`, because the package has no lint script. The root `npm run lint` inside the gate passed.
- Tree clean.

tally: 6 of 6 fixed, 0 extra fixed