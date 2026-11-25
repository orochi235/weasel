useContextMenu treated keyboard-raised context menus as pointer menus (A): fixed de2d4b911e

Space did nothing on a color, number or text row (A): fixed de3edec58a. A click anywhere on a value row now also focuses its field, as Enter does.

AccessLabel never underlined a final sigma (A): fixed 9e437e5aa5

A menu taller than the viewport could not be scrolled, and the highlighted row ran off screen (A): fixed ba9f8851e3. This also moves HistoryList's scroll-into-box code into a shared `revealInBox`, used by both.

A modified release opened a link with `window.open` and no `noopener` (A+B): fixed a69a8fabb9

A release over a color row didn't open its picker, and over a text or number row didn't focus its field (B): fixed 2cb60643af

A text or number draft was lost when an outside press or a window blur closed the menu (B): fixed e324ab6ead

A silently opened trigger menu dropped focus to `<body>` when it closed from inside the color picker (B): fixed b3ae3f7b15

Enter on the picker's native color input pulled focus to the panel, so the menu closed while picking (B): fixed 1abf1d596e

Extra: MenuPanel's function grew past the 120-line cap, and its placement moved into a `usePlacement` hook: 023099ce88. This is upkeep for the fixes above, not a defect.

Checks:
- AccessLabel.test.tsx: pass (7)
- ContextMenuHost.test.tsx: pass (33)
- MenuRow.values.test.tsx: pass (27)
- MenuRow.test.tsx: pass (7)
- useContextMenu.test.tsx: pass (3)
- MenuPanel.test.tsx (new): pass (1)
- menuPanelCss.test.ts: pass (5)
- useMenuTrigger.test.tsx (new): pass (1)
- HistoryList.test.tsx: pass (7)
- `npm run checks:gate`: pass, all 32 (the first run failed check:size, which 023099ce88 fixes)
- `npm run check:changesets`: pass
- `npm run lint -w @weasel-js/ui`: not run, because @weasel-js/ui has no lint script. eslint on the changed files: pass, and the gate's root `npm run lint` passed.
- Browser tests: none touched. The real event order behind the draft-loss and picker-Enter findings was only exercised in jsdom.

tally: 9 of 10 fixed, 0 extra fixed