A press on a disabled title while another menu is open — A — fixed 10be81bf0d. The press now closes the open menu. Nobody had ruled on this, so I made the call and recorded it in `docs/unruled.md` (new section "Audit round fifty-eight (2026-11-20): MenuBar"). Moving the pointer onto a disabled title still leaves the open menu as it is.

Pointer crossing onto a title with no rows sends focus out of the bar — A — fixed b7a63097f4

Touch tap on a second title opens that menu and closes it at once — A — fixed ec5c5766ed. Touch `pointerenter` is now ignored, so the press alone opens the menu.

Story blurb puts the readout between Edit and View, but it is drawn after the titles — A — fixed de6dbba497. The leaf's description is corrected too. No changeset, since it only touches the story.

Same touch tap closing every menu — B — duplicate of A's touch-tap finding (ec5c5766ed)

Same story blurb and leaf description — B — duplicate of A's story-blurb finding (de6dbba497)

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/MenuBar/MenuBar.test.tsx`: pass, 25 passed (25)
- `npm run checks:gate`: pass, "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/ui`: not run. `@weasel-js/ui` has no `lint` script, so npm errors with "Did you mean this?". The gate's root `npm run lint` passed.

tally: 6 of 6 fixed, 0 extra fixed