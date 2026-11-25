I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole document is below, as the brief allows.

# Audit round 51, area `labkit.specimen`: blind reviewer findings

## The "Rings" slider in the PropertyPanel cell cannot be moved: its value is a literal and its onChange is a no-op
- where: packages/labkit/src/specimen/ShapePanelCell.tsx:88-97 (ShapePanelCell)
- scenario: open the "Bevel" group and drag the "Rings" slider, or press an arrow key on it. The slider is passed `value={32}` and `onChange={() => {}}` and no `onInput`. Under the edit-callback rules (`docs/conventions.md`, "Edit callbacks"), the control draws its own draft during the drag and then drops it, so the thumb jumps back to 32 on release, and a key step does nothing at all. Every other field in the same panel keeps its value in `useState`. `Specimen`'s doc says each control is shown "in a small working state", so this one should hold its value in state as well.
- evidence: read (ShapePanelCell.tsx; the onInput-less draft behavior is stated in docs/conventions.md:359-362)
- severity: low

## The SidebarPanel cell draws a hide button that does nothing
- where: packages/labkit/src/specimen/PanelsAndRows.tsx:30 (PanelsAndRows)
- scenario: `onHide={() => {}}` makes `SidebarPanel` render its hide button (`SidebarPanel.tsx:83-88` renders it whenever `onHide !== undefined`). Pressing it leaves the panel on screen with nothing changed. Collapse is wired to state in the same cell, so the cell's other control works. Hide should go through state too (and the panel should come back somehow), or the button should not be offered.
- evidence: read
- severity: low

## The momentary SegmentedBar (Undo/Redo) is a toolbar with no accessible name
- where: packages/labkit/src/specimen/ButtonsAndToggles.tsx:92-98 (ButtonsAndToggles)
- scenario: a `mode="momentary"` bar renders `role="toolbar"` (`SegmentedBar.tsx:126`) and takes its name only from `aria-label`, `aria-labelledby` or an enclosing `Field`. This one has none of the three, so a screen reader announces an unnamed toolbar. Every other group control in the specimen is named: both align bars, the "Text style" bar, `ToolGroup` "Tools", and `Bar` "My Trial" and "Editor status". On 2026-11-18, commit 9dfc0b9e0a named the specimen's Plot2D for the same kind of gap.
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

<!-- done: 3 findings, files read: 18 -->