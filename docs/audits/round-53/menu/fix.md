Typing a letter during a search now extends the search; it no longer picks a row by its access letter (432998fb9e, from B). The tests fail before this fix and pass after. I made a behavior call no one has ruled on, and recorded it in `docs/unruled.md`: a mid-search character extends the search only if the search still finds a row afterward. Otherwise the key acts as if no search were running, so a space there still chooses. The narrower rule keeps an existing test passing: with a submenu open, typing `r` then `i` still runs the inner row whose access letter is `i`.

Hovering a separator now cancels a submenu's pending open, as hovering the panel's padding already did (13fd3b32cf, from A).

**Checks:**
- `packages/menu/src/keyPlan.test.ts`: pass (4)
- `packages/menu/src/keyPlan.pbt.test.ts`: pass (3)
- `packages/menu/src/controller.test.ts`: pass (37)
- `packages/menu/src/controller.pbt.test.ts`: pass (1)
- `packages/menu/src/controller.meta.pbt.test.ts`: pass (3)
- `packages/menu/src/controller.values.test.ts`: pass (19)
- `packages/menu/src/letters.pbt.test.ts`: pass (2)
- Every non-browser test under `packages/hud/src/menu`, plus `packages/hud/src/accessible.pbt.test.ts`: pass
- `npm run check:changesets`: `OK — 2539 changeset(s).`
- `npm run checks:gate`: `checks:gate: all 32 passed`
- `npm run lint -w @weasel-js/menu`: `@weasel-js/menu` has no lint script; the root `npm run lint` inside the gate passed.
- No `*.browser.test.*` files were touched.

The tree is clean.

tally: 2 of 2 fixed, 0 extra fixed