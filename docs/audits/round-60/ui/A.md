# Audit round 60, area `ui`: findings

## useRovingTabIndex splits a grid into rows of a fractional `columns`, where `tiling` lays it out floored
- where: packages/ui/src/useRovingTabIndex.ts:101 (gridRows), :256-259 (onKeyDown)
- scenario: `tiling(10, { columns: 2.5 })` with `tilingRoving` (it passes `spec.columns` through raw). `tileGrid` and `gridLayout` both run `columns` through ui-input's `wholeColumns` (floor, at least 1), so the grid is drawn 2 across. The hook's own `gridRows` tests `row.length >= columns` against the raw 2.5, which puts 3 items in each row. Then `gridLayout(rows, 2.5)` (2 across) gets rows of 3. Up/Down jump to items that are not drawn above or below the focused one, and Left/Right row ends don't match what is drawn. ui-input has its own `gridRows` (grid.ts:103) that floors. The hook should use that one, or floor the same way.
- evidence: read (packages/ui-input/src/grid.ts:56, :103, :124)
- severity: medium

## nodeText reads a bigint or a non-array iterable child as no text
- where: packages/ui/src/nodeText.ts:5-9 (nodeText)
- scenario: React 19's `ReactNode` includes `bigint` and `Iterable<ReactNode>`, and React renders both as text. `nodeText(<>{10n} items</>)` returns `" items"`, and `nodeText(new Set(['a', 'b']))` returns `''`, where the expected results are `"10 items"` and `"ab"`. Button (Button.tsx:190) and domItemList (domItemList.tsx:23) measure their labels through `nodeText`, so `<Button>{count}</Button>` with a bigint `count` is sized as if it had no label. A bigint should go through `String`, and any iterable should be walked the way an array is.
- evidence: read (@types/react 19 `ReactNode` lists `bigint`)
- severity: low

## useScrollSpy's `ids` are documented as element ids, but sections are found by `data-spy-section`
- where: packages/ui/src/useScrollSpy.ts:52-53 (UseScrollSpyOptions.ids), :103 and :123 (measure, scrollTo)
- scenario: The only documented contract is `ids: "Section element ids, in document order"`. A consumer that puts `id="general"` on each section and passes `ids: ['general', …]` gets `active` stuck at null, and `scrollTo('general')` does nothing: both look up `[data-spy-section="general"]`, an attribute named nowhere in the public docs. The docs should name the attribute, or the lookup should match the documented id.
- evidence: read (grep finds `data-spy-section` only in this file)
- severity: low

## useRemovedRowFocus loses focus to the page when the focused row is remounted under the same id
- where: packages/ui/src/useRemovedRowFocus.ts:44-65 (rowRef, layout effect)
- scenario: In a `Tree` (nested `ul`/`li`, Tree.tsx:138-163), the focused row is moved into another branch, for example by a drop through `onMove`. React unmounts the row's `li` under its old parent and mounts a new one under the new parent. The old ref lets go while it holds focus, so `held` gets the id. The new element's ref then sets `els[id]` again, `gone` finds no id that is held and missing, and nothing refocuses. Removing the old `li` has already sent focus to `document.body`, so the next arrow key goes nowhere. That is the failure the hook says it prevents. A row that held focus, still drawn but now on a new element, should get focus back on its new element.
- evidence: read
- severity: low

## createDomFocusScope enters an unchecked radio group at its first radio going backward too
- where: packages/ui/src/createDomFocusScope.ts:31-47 (oneRadioPerGroup), :84-92 (moveFocus)
- scenario: The scope promises the browser's Tab order. A named radio group with nothing checked is reduced to its first radio for both directions. The browser enters such a group at its first radio on Tab and at its last radio on Shift+Tab. Take a group `size` with `s`, `m` and `l` unchecked, followed by a button. `moveFocus('prev')` from the button lands on `s`, where Shift+Tab lands on `l`. The stop for an unchecked group depends on direction, so `tabOrder` alone can't answer it.
- evidence: read
- severity: low

## ui's dlog example enables two namespaces that nothing logs under
- where: packages/ui/src/dlog.ts:7 (module doc)
- scenario: The documented way to trace ui is `localStorage.setItem('weasel.debug', 'curve-editor,layer-stack')`. No `dlog` call in the repo uses `curve-editor` or `layer-stack`. ui logs under `layer-list`, `layered-curve-editor`, `function-layer`, `curve-field`, `plot2d` and `property-panel`, so following the example turns on no output at all. The example should use namespaces that exist, or a list should be kept in one place, the way routing's `dlog.ts` lists the kit's own.
- evidence: read (grep for `dlog('curve-editor` / `dlog('layer-stack` across packages: 0 hits)
- severity: low

## createDomFocusScope's tab order leaves out media elements with controls
- where: packages/ui/src/createDomFocusScope.ts:4 (TABBABLE), :68-71 (tabOrder)
- scenario: A HUD scope holding `<video controls>` or `<audio controls>` with no `tabindex`. Browsers put both in the sequential focus order with `tabIndex` 0, and Tab stops on the player. `TABBABLE` names neither, so `tabOrder()` leaves the player out, and `moveFocus('next')` steps from the control before it to the control after it. Selecting on what `isTabbable` already checks (`tabIndex >= 0`), or adding `audio[controls], video[controls]`, would match the browser.
- evidence: read
- severity: low

## useScrollSpy never listens to a container that mounts after the hook does
- where: packages/ui/src/useScrollSpy.ts:112-118 (scroll subscription effect)
- scenario: A panel calls `useScrollSpy({ rootRef, ids })` but renders the scrolling container only once its data has loaded (`{loaded && <div ref={rootRef}>…</div>}`). The effect runs at mount with `rootRef.current === null` and returns early. Its dependencies (`rootRef` and `measure`) don't change when the ref is filled in, so no `scroll` listener is attached and nothing is measured. `active` stays null however far the reader scrolls, until `ids` or `slack` happen to change. `useRovingTabIndex` in the same package handles this same case: it tracks the attached element in state (`listened`) so a ref filled after mount still gets its listeners.
- evidence: read
- severity: low

## useRovingTabIndex moves focus on modified arrows and Home/End, and swallows browser chords
- where: packages/ui/src/useRovingTabIndex.ts:242-268 (onKeyDown)
- scenario: Focus is on a toolbar button inside a `useRovingTabIndex` container. Alt+Left (Back on Windows and Linux), Cmd+Left or Ctrl+Home goes to `rovingTarget`/`rovingGridTarget`, which read only `e.key`. Focus moves to the neighbor and `preventDefault()` cancels the browser's own action. A consumer binding Alt+Arrow or Shift+Arrow on the items for something else (moving a tab, say) sees focus move on the same key. `useRowNavigation` in the same package passes modifiers to `rowKey` and leaves unclaimed chords alone. The two keyboard paths answer "does a modified arrow move focus?" differently. Unmodified keys only (Shift aside, if wanted) would match.
- evidence: read (packages/ui-input/src/list.ts:66 `rovingKey` takes only the key string)
- severity: low

## Files read
packages/ui/src/alongTrack.ts
packages/ui/src/byRank.ts
packages/ui/src/color/ColorRamp.stories.module.css
packages/ui/src/color/ColorRamp.stories.tsx
packages/ui/src/createDomFocusScope.ts
packages/ui/src/createDomMeasureEnv.ts
packages/ui/src/cssPx.ts
packages/ui/src/cursors/cursors.stories.module.css
packages/ui/src/cursors/cursors.stories.tsx
packages/ui/src/dlog.ts
packages/ui/src/dropTarget.ts
packages/ui/src/handles.ts
packages/ui/src/icons.table.ts
packages/ui/src/index.ts
packages/ui/src/kitSettings.ts
packages/ui/src/nativeProps.ts
packages/ui/src/nodeText.ts
packages/ui/src/optionKey.ts
packages/ui/src/overlays/blockFrame.ts
packages/ui/src/overlays/overlayAnimation.ts
packages/ui/src/overlays/overlayFrame.module.css
packages/ui/src/overlays/overlayFrame.ts
packages/ui/src/overlays/portalHost.tsx
packages/ui/src/pathThrough.ts
packages/ui/src/pbt.fixture.ts
packages/ui/src/rowControls.ts
packages/ui/src/selectionRoving.ts
packages/ui/src/snap.ts
packages/ui/src/themes/testing/mountThemed.tsx
packages/ui/src/tiling.module.css
packages/ui/src/tiling.ts
packages/ui/src/useAsyncOptions.ts
packages/ui/src/useAttachRef.ts
packages/ui/src/useDebouncedText.ts
packages/ui/src/useEditDraft.ts
packages/ui/src/useFieldLocale.ts
packages/ui/src/useIdleSettle.ts
packages/ui/src/useRemovedRowFocus.ts
packages/ui/src/useReorderDragList.ts
packages/ui/src/useRovingTabIndex.ts
packages/ui/src/useRowNavigation.ts
packages/ui/src/useScrollSpy.ts
packages/ui/src/useTextDraft.ts
packages/ui/src/useTypeahead.ts
packages/ui/src/wrapLine.ts

(packages/ui/src/icons.gen.ts, a generated file, was skimmed only: its header, the start of the `UiIconName` union, and every line outside the union. It is not counted.)

<!-- done: 9 findings, files read: 45 -->
