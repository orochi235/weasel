# ui-A findings (audit round 30, frozen f10daafb87)

## ScaleBar's label mixes two locales: the length is always en-US, the magnification follows the field locale
- where: packages/ui/src/components/ScaleBar/ScaleBar.tsx:32-37 (ScaleBar)
- scenario: under `<I18nProvider locale="de-DE">` (or a German browser), a zoom with magnification 1.5 and a 2.5 cm bar. `drawn` now goes through `present(..., { locale })` and reads "1,5×", but `bar.label` comes from quantity's `scaleBar` → `formatUnit`, which is `toFixed` and always writes a decimal point. The aria-label reads "Scale: 2.5cm, drawn at 1,5×" — one sentence, two decimal separators. e06225e34d moved only the half it touched.
- evidence: read
- severity: low

## Transport's time readouts ignore the locale its rate readout now follows
- where: packages/ui/src/components/Transport/Transport.tsx:66-67 (`seconds`, `spokenSeconds`) vs :119-121 (`rateText`, `rateSpoken`)
- scenario: under a de-DE locale the rate slider's thumb reads "1,5×" (qty with `{ locale }`, e06225e34d) while the playhead readout beside it reads "1.50s / 4.00s" and speaks "1.50 seconds" (`toFixed(2)`). The commit says Transport reads `useFieldLocale` so an I18nProvider reaches it; only the rate does. Same bar, two decimal separators.
- evidence: read
- severity: low

## ui-canvas's public types name packages its manifest does not declare (`@weasel-js/guides` reached by nothing)
- where: packages/ui-canvas/package.json (dependencies); packages/ui-canvas/src/components/Rulers/Rulers.tsx:2 (`RulersProps.rulers: Rulers` from `@weasel-js/guides`); also `View` from geom (SceneGradientHandles.tsx:5), `UnitScope`/`UnitTable` from quantity (SelectionPanel.tsx:3, AnchorFields.tsx:4), `Op` from history (useSceneLayerList.ts:7)
- scenario: the built `.d.ts` of `Rulers` imports `@weasel-js/guides`, which neither ui-canvas nor `@weasel-js/ui` depends on. A consumer installing `@weasel-js/ui-canvas` gets "Cannot find module '@weasel-js/guides'" in the declarations (or, under `skipLibCheck`, `rulers: any`, so a wrong argument type-checks). geom/quantity/history resolve only by hoisting through `@weasel-js/ui`'s deps. `check:imports` skips type-only imports by design (scripts/lib/imports.mjs), and the smoke-consumer test packs every sibling into one tree, so nothing catches it. Introduced by the 800e2932f0 move out of ui.
- evidence: read
- severity: low

## SelectionPanel draws a kind's schema from the last properties entry of that name but settles writes with the first
- where: packages/ui/src/components/PanelCells/model.ts:219 (effectiveSections, `new Map(entries.map(...))` — last entry wins) vs packages/ui-canvas/src/components/inspector/SelectionPanel/SelectionPanel.tsx:129-133 (`traits.current.properties.find(...)?.settle` — first entry wins)
- scenario: the prop doc invites `properties={[...defaultNodeProperties, extras]}`; with no `features`, `nodeTraitsOf` returns the consumer's array as given (core `mergeNamedEntries`: `own.length === 0 → consumer`), duplicates included. A consumer appending `{ name: 'rect', schema: mine, settle: mySettle }` over a library entry named `rect` sees its own schema drawn, but every commit and draft goes through the earlier entry's `settle` (or none), so `mySettle` never runs and its derived fields are never written. One decision ("which entry is this kind's"), answered two ways in one panel.
- evidence: read
- severity: medium

## useReorderDragList starts a reorder from any mouse button; only PageTabs gates it
- where: packages/ui/src/useReorderDragList.ts:231-293 (onPointerDownRow — no `isPrimaryPress`); callers that pass the handler straight through: DataGrid/DataGrid.tsx:227 (HandleCell), ListEditor/ListEditor.tsx:150, EffectList/EffectList.tsx:138 (grip), TokenField/TokenField.tsx:147 (chip)
- scenario: right-press a ListEditor or DataGrid drag handle, or a TokenField chip, and move past the threshold: the row is dragged and `onReorder` fires on release. A middle- or right-button press released in place goes through `onClick` and fires `onPress` as a selection click, and a pen's barrel button does the same. `startThresholdDrag` (routing/src/interactions/thresholdDrag/thresholdDrag.ts) does not look at the button. PageTabs (`usePageTabs.tsx:126`) and Bar's reorder (`useBarReorder.ts:65`) check `isPrimaryPress` before starting, so the same gesture is a reorder in one list and nothing in another.
- evidence: read
- severity: medium

## PlotTableView keys rows by index, so an opened row's detail jumps to another row after a remove or reorder
- where: packages/ui-canvas/src/components/PlotDataPanel/PlotTableView.tsx:24 (`rows = … ({ id: String(index), index })`), with DataGrid holding `expanded` by row id (packages/ui/src/components/DataGrid/DataGrid.tsx:116, :200)
- scenario: a gantt with sections A, B, C; open C's details (expanded = {"2"}), then remove A with its × button. B and C shift to indices 0 and 1, and a new row (or nothing) at index 2 holds the open state: C's task table closes and, if there is a fourth section, that one opens instead. Dragging B below C does the same: the open detail stays on index 1 and now shows B's tasks under C's row position. The open state should follow the item, not its slot.
- evidence: read
- severity: low

## CharacterOptions shows "No fill" as off, not mixed, over a range where only some runs have no fill
- where: packages/ui-canvas/src/components/inspector/CharacterOptions/CharacterOptions.tsx:97 (`noFill: style.fill !== MIXED && …`) and :113-124 (characterMixed never adds `noFill`)
- scenario: select text whose first word has `fill: null` and the rest black, so `effectiveStyle.fill` is `MIXED`. `fill` is marked mixed, but `noFill` reads `false` and is not in the mixed set, so the toggle draws plainly unpressed, claiming the whole range has a fill. Every other key with disagreeing sources draws indeterminate; this one should too whenever `fill` is `MIXED` and the runs disagree on whether there is one.
- evidence: read
- severity: low

## useSceneLayerList misplaces a top-level drop when the page run's children share the top level with other roots
- where: packages/ui-canvas/src/components/SceneLayerList/useSceneLayerList.ts:157-175 (onReorder), with `build` flattening the run into the top level at :108
- scenario: with the pasteboard on, `scene.roots` is `[run, P]` (P a root drawn in front of the page) and the run holds c1, c2, c3 back to front, so the list's top level reads P, c3, c2, c1. Drag c1 to the gap between P and c3 (LayerList gap index 1). `parent` is the run (`topParent`), `left`/`shown` are the run's children [c2, c3], and `at` is 1 because only annotation rows are subtracted, so `back` = 1 and c1 lands before c3: order c2, c1, c3, not c2, c3, c1 as the drop marked. Every top-level drop is off by the number of non-run root rows above the gap. Dragging P among the run's rows is wrong the other way: `left` is `scene.roots`, where the run is one entry, while the index counted each of its children.
- evidence: read
- severity: medium

<!-- done: 8 findings, files read: 72 -->
