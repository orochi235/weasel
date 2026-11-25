All six distinct findings (seven as listed, one reported by both reviewers) are fixed, each in its own commit with a test that failed before the fix and its own changeset.

- `Select`'s option body and note were defined twice, and ComboBox's copy lacked `min-width: 0` (A+B): fixed 6cbc17e223 → rebased to acfbc1b896. `Select` now composes `.optionBody` and `.note` from `listbox.module.css`, which carries `min-width: 0` and `display: block`.
- A `width='fit'` select whose key names no option never measured the placeholder it shows (A): fixed c88f602088. The hint is reported whenever the placeholder shows, but not while React Aria's rows are still unbuilt on the first render, when even a valid key shows the placeholder.
- `variant='bare'` ignored `--wzl-select-pad` and `--wzl-select-bg` but honored `--wzl-select-border` (A): fixed 6986742bd3. I also deleted the `.bare.underlined` / `.bare.plain` `padding: 0` rule, which repeated `.bare .trigger` and would have overridden the hook.
- In an end- or center-aligned list, a described row's label landed off the trigger's value (B): fixed 32c2132342. `.optionBody` now sets `align-items` and `text-align` to the list's edge.
- The over-trigger clamp used the layout viewport where React Aria uses the visual viewport (B): fixed 5063228bbd. I confirmed in the installed `react-aria` `calculatePosition` that it uses `visualViewport`. The clamp now uses the visual viewport, cut to the overlay frame when there is one.
- Only four of the props the types omit were dropped at run time (B): fixed 65c39da649. `isDisabled`, `isOpen`, `isInvalid` and `isRequired` are now dropped too, from one shared `ReplacedProps` list.
- Option body and note in two copies (B): duplicate of the first finding.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `Select/Select.test.tsx`: pass (56)
  - `Select/alignOverTrigger.test.tsx`: pass (8)
  - `Select/Select.css.test.ts` (new): pass (3)
  - `Select/Select.held.test.tsx`: pass (5)
  - `Select/Select.popup.test.tsx`: pass (2)
  - `ComboBox/ComboBox.test.tsx`: pass (28)
- Unrun here: `Select/Select.fit.browser.test.tsx` (not touched, but covers the fit sizer).
- `npm run checks:gate`: pass, "checks:gate: all 33 passed". The first run failed `audit:jsdoc` because my type alias split `SelectProps` from its JSDoc; I folded the fix into that commit and reran. Later edits touched only changeset prose.
- `npm run check:changesets`: pass, "OK — 904 changeset(s), 31 with warnings". None of the warnings are from my changesets; I shortened three titles that were over 140 characters.
- `npm run lint -w @weasel-js/ui`: there is no such script (the package has only `build` and `test`). `npx eslint packages/ui/src/components/Select/` passed.
- The tree is clean.

tally: 7 of 7 fixed, 0 extra fixed