- List keyboard/hover/press rows held as indexes, so they drift when `setRows` inserts or reorders (A): fixed 0bedc1da03
- List label drawn with no width limit (A): fixed bf850b2efb
- Button label drawn with no width limit (A): fixed 6df825d04f
- List with a `height` shorter than its rows draws rows past its bounds where no press reaches them (A): fixed b156b01c1f. Rows are now clipped to the bounds, the wheel scrolls them (claimed only while there is something to scroll), and the keyboard's row is scrolled into view. This adds `ListWidget.scrollTop` and `HudListState.scrollTop`, so its changeset is `minor`.
- Button presses on Space keydown and on every auto-repeat (A): fixed 5beb851960. Space now presses once on keyup, a Space keyup is ignored if focus left after its keydown, and Enter still presses on keydown.
- Button presses on Space keydown and repeat, and Space keyup falls through to the canvas (B): duplicate of A's Space finding, fixed 5beb851960
- Long window title wraps out of the titlebar, because `maxWidth` is a wrap width (B): fixed 8c618ce03d
- `setBounds` called from the window's own `onMove`/`onResize` ends the drag after one step (B): fixed 3b5abbd35b
- List and button labels not held to their width (B): duplicate of A's list-label and button-label findings, fixed bf850b2efb and 6df825d04f
- List shorter than its rows draws them out of reach (B): duplicate of A's height finding, fixed b156b01c1f
- Window not re-clamped when the host shrinks (B): fixed 233d011a81. A draw at a new host size that has area pulls the window back on and reports the move through `onMove`.

No extra defects fixed. The same unlimited-width label draw is in the HUD menu's row labels (`packages/hud/src/menu/panelCommands.ts:138`). That is outside this area, so I left it alone. The new internal `ellipsize` helper in `packages/hud/src/menu/textWidth.ts` can fix it there.

Checks:
- vitest, each touched file run alone with `--maxWorkers=1`: `menu/textWidth.test.ts` pass (6), `widgets/button.test.ts` pass (28), `widgets/button.pbt.test.ts` pass (3), `widgets/list/list.test.ts` pass (15), `widgets/window/window.test.ts` pass (50), `widgets/window/window.pbt.test.ts` pass (2). I also ran the untouched `button.shrunk`, `list.pbt`, `window.shrunk`, `window.integration`, `edges.pbt`/`edges.shrunk` and the four non-browser loupe tests: all pass.
- `npm run checks:gate`: fail, 2 of 32. Both failures are already in the frozen commit, in files this branch doesn't touch, so I didn't fix them:
  - `check:numeric`: fail on `apps/draw/src/dev/audits/Treemap.module.css:119`, which writes raw `font-variant-numeric: tabular-nums` (from e478753df0).
  - `lint -w @weasel-js/labkit`: fail on a raw `font-size` in `components/SpanStrip/SpanStrip.module.css:40`.
  - Every other check passes, including `typecheck`, `typecheck:packages`, `check:changesets` and `check:size`.
- `npm run lint -w @weasel-js/hud`: can't run, because hud has no `lint` script. In its place, `npx eslint` on every changed `.ts` file: pass.
- The tree is clean apart from `.skulk/`.

tally: 11 of 11 fixed, 0 extra fixed