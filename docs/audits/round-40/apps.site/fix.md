Canvas features tools column shows set ids, not member tools (A): fixed 479ab93937

Canvas features page credits the presets to core, not editing (B): fixed fe0b0880a6

Unknown `?pkg=` filters Releases to nothing with no chip to clear it (A): fixed 887182b5d1. Unknown package names are now dropped, the same way unknown tags already are. This replaced an existing test that asserted the old empty-list behavior. I found no ruling behind that test, so I didn't add a `docs/unruled.md` entry.

Sidebar never marks a package page active (A): fixed bae6dd4a88. The package heading gets `active` on every tab of its package and is drawn in `--wzl-accent-fg` with no fill, because it is inline text.

typography.css `.ckd-whatsnew-table th` targets a class nothing renders (A+B): fixed 719c6b44c0. The rule moved to `.grid th` in `WhatsNew.module.css`. `stylesheets.test.ts` now fails on any `ckd-*` class in the site's global stylesheets that nothing under `apps/` emits; this was the only one.

Prose's own list of fence languages has drifted from CodeBlock's (B): fixed 078adbacf5. Prose now holds an exhaustive record of `CodeLanguage`, so a language CodeBlock adds won't compile until Prose lists it, plus html/xml/svg → markup. Swept `apps/`: no other place maps fence languages.

Demo last-modified dated by UTC day on one page and local month on another (B): fixed b3fbd16d9f. `formatRelativeOrIso` moved to `isoDay.ts` as `ageOf`, and its month is now the UTC month.

Extra defects found while fixing: none.

No changesets: apps/site is not a published package. It has no `package.json`, so it has no `lint -w`; root `npm run lint` covers it.

Checks:
- `npx vitest run --maxWorkers=1` on each touched file:
  - `apps/site/__tests__/Features.test.tsx`: pass (6)
  - `apps/site/__tests__/Releases.test.tsx`: pass (16)
  - `apps/site/__tests__/SiteNav.test.tsx`: pass (1)
  - `apps/site/__tests__/stylesheets.test.ts`: pass (2)
  - `apps/site/__tests__/Prose.test.tsx`: pass (3)
  - `apps/site/__tests__/isoDay.test.ts`: pass (2)
  - `apps/site/__tests__/WeaselDemos.routing.test.tsx`: pass (19)
  - Other `Releases*` test files: pass
- `npm run checks:gate`: "checks:gate: all 32 passed" (includes `npm run typecheck:packages` and root `npm run lint`)
- No browser tests touched.
- Tree clean.