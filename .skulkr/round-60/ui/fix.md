- useRovingTabIndex splits rows by a fractional `columns` (A): fixed 83daf837e8 (also exports ui-input's `wholeColumns`)
- nodeText reads a bigint or a non-array iterable child as no text (A): fixed 4e61e3082b
- useScrollSpy's `ids` are documented as element ids but found by `data-spy-section` (A): fixed 42573381d1 (the docs now name the attribute; the lookup is unchanged)
- useRemovedRowFocus loses focus when the focused row is remounted under the same id (A): fixed 2c15dbb289
- createDomFocusScope enters an unchecked radio group at its first radio going backward too (A): fixed ac377971db (`FocusScope.tabOrder` in ui-logic takes an optional direction; the pbt properties now walk `tabOrder(dir)`)
- ui's dlog example names namespaces nothing logs under (A): fixed 5a003633f3 (a test now keeps the example's namespaces matched to ones that exist)
- createDomFocusScope's tab order leaves out media elements with controls (A): fixed bf917ec529
- useScrollSpy never listens to a container that mounts after the hook (A): fixed 79ae4708af
- useRovingTabIndex moves focus on modified arrows, Home, and End (A): fixed 9f976c3c50. This was my call: any of Alt, Ctrl, Meta, or Shift leaves the key to the browser and the item, with no opt-in to walk on one. It is recorded in `docs/unruled.md`.
- useScrollSpy never subscribes when its container mounts late (B): duplicate of A's "useScrollSpy never listens to a container that mounts after the hook"
- useScrollSpy's active section goes stale on a resize or reflow with no scroll (B): fixed 02bf48b65e (a ResizeObserver on the container and each section)
- useRovingTabIndex counts hidden items as stops (B): fixed e78c1bab75 (`isRendered` moved out to share with createDomFocusScope; the stop is checked lazily so jsdom isn't asked for computed styles per item)
- createDomMeasureEnv measures every document's text on the first document's canvas (B): fixed ba3a6731e0 (one canvas per document through `createPart`)

Extra:
- sweep: curved run text (`Along/runText.ts`) measured on one canvas from the global `document` for every document: fixed a8bf2fde8f (uses the same per-document helper). It has no failing-first test through `useRunText`. `measureContext.test.ts` covers the helper it now calls.
- e1f519f16c only shortens four of my own changeset titles to fit `check:changesets`' 140-character limit. It is not a defect fix.

Checks:
- `npx vitest run --maxWorkers=1`, each touched test file alone: createDomFocusScope.pbt pass, createDomFocusScope pass, createDomMeasureEnv pass, dlog pass, measureContext pass, nodeText pass, useRemovedRowFocus pass, useRovingTabIndex pass, useScrollSpy pass
- Also run for the roving and focus changes, all under `--project=weasel-ui`: the Bar, PageTabs, TokenField, Segmented, MenuBar, ToolRail, ToggleChips, SwatchGrid, Tree, and Menu directories, plus PrefsRail (pass), useRowNavigation (pass), EffectList and EffectList.hold (pass), measureContract (pass), CurvedLabel (pass), and useRovingTabIndex.rtl and useRovingTabIndex.disabled (pass)
- Unrun browser test: none touched
- `npm run checks:gate`: pass (all 32 passed)
- `npm run typecheck:packages -- ui ui-input ui-logic`: pass
- `npm run lint -w` for ui, ui-input, and ui-logic: fail, "Missing script: lint" for all three. None of these packages defines one; the root `npm run lint` inside the gate passed.
- `npm run check:changesets`: pass

The tree is clean and nothing under `.skulkr/` was touched.

tally: 12 of 13 fixed, 1 extra fixed