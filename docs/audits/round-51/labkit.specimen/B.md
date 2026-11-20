<!-- the findings file could not be written (permission denied), so the whole document is below -->

# Audit round 51: labkit.specimen

Note: the brief names frozen commit d6aa8f2ede77…, but this checkout doesn't contain it. I read the tree at HEAD 674caba3dd, where none of the listed files has uncommitted changes.

## The specimen's demo ToastRegion takes over the app's refusal toasts while it is mounted
- where: packages/labkit/src/specimen/OverlaysAndFeedback.tsx:60 (OverlaysAndFeedback)
- scenario: `<ToastRegion queue={toasts} placement="bottom-right" />` leaves `refusals` at its default of `true`. Mounting it calls `holdRefusals(toasts)` (packages/ui/src/components/Toast/Toast.tsx:84). `refusals.ts` tells each refusal only to the most recently held queue (`tellers.at(-1)`). Embed the Specimen in a page that has its own ToastRegion, such as the site's `ThemeDemo` (apps/site/demos/ThemeDemo.tsx:57) or any theme preview. While the specimen is mounted, every "command refused" toast from the host app's key bindings goes to the specimen's private demo queue instead of the app's. A local toast demo should not claim the app-wide refusal channel; it should pass `refusals={false}`.
- evidence: read
- severity: medium

## The "Rings" property row is pinned to 32 with a no-op onChange, so it can't be edited
- where: packages/labkit/src/specimen/ShapePanelCell.tsx:88-97 (ShapePanelCell)
- scenario: the user opens the Bevel group and drags Rings. The control draws its draft during the drag (commit-only caller) and snaps back to 32 on release, because `value={32}` and `onChange={() => {}}`. Every other row in the panel holds state. The page promises each control "in a small working state", and this one looks broken.
- evidence: read
- severity: low

## The SidebarPanel's hide button is wired to a no-op
- where: packages/labkit/src/specimen/PanelsAndRows.tsx:30 (PanelsAndRows)
- scenario: passing `onHide={() => {}}` makes SidebarPanel render its hide button (SidebarPanel.tsx:83-88). Clicking it does nothing, so the panel shows a dead control. The handler should hide the panel through state, or `onHide` should be left out.
- evidence: read
- severity: low

## The InlineRange cell skips the range's edit protocol, so Escape doesn't cancel a drag
- where: packages/labkit/src/specimen/SliderCells.tsx:43-49 (SliderCells)
- scenario: the cell controls `InlineRange` through the native React `onChange` with an `event.target` cast. InlineRange's edit callbacks are `onValueInput`/`onValueChange`/`onValueCancel` (useRangeEdit.ts:11-15). Given none of them, `useRangeEdit` treats it as a plain native range (`reports` is false), so Escape mid-drag doesn't restore the starting width, which docs/conventions.md "Edit callbacks" requires. Every other control in the specimen uses the kit's protocol. It should be `onValueInput={setWidth}`.
- evidence: read
- severity: low

## The right-docked Sidebar draws at the left edge of its box
- where: packages/labkit/src/specimen/PanelsAndRows.tsx:24-35 and packages/labkit/src/specimen/Specimen.less:61-68 (`.lk-specimen__box`)
- scenario: `<Sidebar side="right">` is the only child of the flex `.lk-specimen__box`. Sidebar's `.right` class only adds a `border-left` (Sidebar.module.css:12-13) and does nothing to position it. The aside therefore sits flush left, with its docking border against nothing, and the cell shows the opposite of the edge it names. It needs a main sibling (like the ResizeHandle cell's `.lk-specimen__box-main`) or `margin-inline-start: auto`.
- evidence: read
- severity: low

## Files read
packages/labkit/src/specimen/ButtonsAndToggles.tsx
packages/labkit/src/specimen/Cell.tsx
packages/labkit/src/specimen/Dot.tsx
packages/labkit/src/specimen/EditorsAndPlots.tsx
packages/labkit/src/specimen/FieldsAndPickers.tsx
packages/labkit/src/specimen/LabChrome.tsx
packages/labkit/src/specimen/ListsAndData.tsx
packages/labkit/src/specimen/OverlaysAndFeedback.tsx
packages/labkit/src/specimen/PanelsAndRows.tsx
packages/labkit/src/specimen/PrefsCell.tsx
packages/labkit/src/specimen/Section.tsx
packages/labkit/src/specimen/ShapePanelCell.tsx
packages/labkit/src/specimen/SliderCells.tsx
packages/labkit/src/specimen/Specimen.less
packages/labkit/src/specimen/Specimen.stories.tsx
packages/labkit/src/specimen/Specimen.tsx
packages/labkit/src/specimen/ToolChrome.tsx
packages/labkit/src/specimen/alignItems.tsx

<!-- done: 5 findings, files read: 18 -->