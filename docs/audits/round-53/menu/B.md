## A letter typed mid-search is taken as an access letter (or a number-row step) instead of extending the search
- where: packages/menu/src/keyPlan.ts:28-43 (planKey)
- scenario: rows `Bold` (no access letter) and `Open` (`access: 'o'`). Type `b` — typeahead highlights Bold and the
  buffer holds "b". Type `o` within 500 ms: `keyStep` leaves it unhandled, then `accessMatch(rows, 'o')` finds Open and
  planKey returns a `choose` effect, so the controller runs Open and closes the menu. The user was typing "bo" to reach
  Bold. Only a space is diverted to the search while `typeaheadSearching(typed, now)` holds (the 2026-11-11 ruling in
  docs/unruled.md: a key typed within the search window is part of the search); every other character still goes to
  access letters first. Same root: with typeahead parked on a number row (`Zoom`, searching "zoom-" to reach
  `Zoom-out…`), the `-` reaches `keyStep`'s `'+' | '=' | '-'` case and steps the number row's value down rather than
  being typed. Should: while a search is live, a one-character key extends the search before access letters and
  number-row steps are consulted.
- evidence: read
- severity: medium

## Files read
packages/menu/src/access.ts
packages/menu/src/controller.ts
packages/menu/src/dismiss.ts
packages/menu/src/entries.ts
packages/menu/src/heldValues.ts
packages/menu/src/index.ts
packages/menu/src/keyPlan.ts
packages/menu/src/keys.ts
packages/menu/src/links.ts
packages/menu/src/numberText.ts
packages/menu/src/numberValues.ts
packages/menu/src/pbt.fixture.ts
packages/menu/src/placement.ts
packages/menu/src/triangle.ts
packages/menu/src/typeahead.ts

<!-- done: 1 findings, files read: 15 -->
