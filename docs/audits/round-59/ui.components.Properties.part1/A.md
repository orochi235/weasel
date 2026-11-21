I couldn't finish writing `.skulkr/out/findings.md`: my first write went through, but later writes were refused permission. The copy on disk holds only the first finding, so this is the full document.

# Audit round 59 — ui.components.Properties.part1

## ColorControl's per-gesture "moved" memory survives a canceled gesture, so the next settle commits a half that did not move
- where: packages/ui/src/components/Properties/ColorControls.tsx:34-52 (ColorControl, `route`)
- scenario: `alpha` is held apart (a number), with `onAlphaInput`/`onAlphaChange`.
  - Drag the opacity track: the live calls set `moved.current.alpha = true`.
  - Press Escape: ColorField sends the starting color back through `onInput`, which marks alpha as moved again. It then calls `onCancel`, which goes straight to `p.onCancel` and never resets `moved`.
  - The next gesture moves only the color and settles. `gesture.alpha` is still true from the canceled drag, so `onAlphaChange` fires with the unchanged alpha.
  - The result is a spurious commit (an extra write and undo step) for a channel nobody touched. The same happens to rgb after a canceled drag. `moved` should be reset on cancel.
- evidence: read
- severity: low

## A `pack="pairs"` group nested in a default-packed group lays every row full width
- where: packages/ui/src/components/Properties/PropertyGroup.css:30-38
- scenario: `<PropertyGroup title="Outer"><PropertyGroup title="Inner" pack="pairs">…</PropertyGroup></PropertyGroup>`.
  - `.group:not(.groupPairs) .groupBody > :not(.rowColor)` puts a descendant combinator between `.group` and `.groupBody`, so it also matches the inner group's body: the inner body's ancestor `.group` is the outer, unpaired one.
  - At specificity 0,4,0 it beats `.groupPairs .groupBody > *` (0,2,0). The inner rows get `grid-column: 1 / -1` and never pair.
  - The reverse nesting leaks too: a default group inside a pairs group gets `align-self: first baseline` on its rows.
  - `PropertyList.css` avoids this with a child combinator (`.list:not(.listPairs) > …`).
- evidence: read
- severity: low

## A disabled inline paint control drops its `disabledReason`
- where: packages/ui/src/components/Properties/ColorControls.tsx:98-107 (PaintControl)
- scenario: `<PropertyControl kind="paint" control="inline" disabled disabledReason="Locked by the theme" …/>` placed outside a `PropertyRow`.
  - The swatch path hands `disabledReason` to `PaintField`.
  - The inline path wraps the editor in an inert `role="group" aria-disabled` div and passes the reason to nothing: no tooltip and no `aria-describedby`. The reason is neither shown nor announced.
  - Inside a `PropertyField` row the row's help carries the reason.
- evidence: read
- severity: low

## DialogRow's button name drops the value it shows, where the menu control deliberately keeps it
- where: packages/ui/src/components/Properties/DialogRow.tsx:92 (DialogRow)
- scenario: `<DialogRow label="Globs" summary="a, b">`.
  - `aria-label="Edit Globs"` replaces the button's content as its accessible name, so a screen reader hears only "Edit Globs" and never the summary. There is no `aria-describedby` either.
  - EnumControl's menu path makes the opposite call (`EnumControl.tsx:52-53`: "The button's text is its value, so its name has to carry both"). The row's value can't be reached without opening the dialog.
- evidence: read (DialogRow.test.tsx:19 pins the name to exactly `Edit Globs`)
- severity: low

## CurveField's flips and reset bypass the snap and clamp its drags go through
- where: packages/ui/src/components/Properties/CurveField.tsx:84-103,139 (handleFlip, handleFlipVertical, Reset)
- scenario: with `min=0 max=1 step=0.3`, drags land on 0, 0.3, 0.6 or 0.9, via `snapped` (`snapToStep` plus a clamp).
  - "Flip vertically" maps y=0.3 to 0.7, which is off the grid, and commits it unsnapped.
  - A y outside [min, max] flips to a value outside too, unclamped.
  - Drag edits and flip edits disagree on which values the curve may hold.
- evidence: read
- severity: low

## CurveField gives its plot no accessible name and offers no way to give it one
- where: packages/ui/src/components/Properties/CurveField.tsx:108-125 (CurveField)
- scenario: `LayeredCurveEditor` renders the plot as `role="group"`, focusable when history is on, and named only by `aria-label`.
  - `CurveFieldProps` has no `aria-label` or `name`. CurveField passes none and doesn't read its row's label, unlike the other Properties controls, which go through `useNameText`/`useFieldControl`.
  - So labkit's `CurveRow` (`packages/labkit/src/controls/CurveRow.tsx:33`) puts an unnamed group in its row.
  - Two curve fields in one panel also show identical "Flip horizontally", "Flip vertically" and "Reset" buttons, with nothing saying which curve each acts on.
- evidence: read
- severity: low

## Font family and weight controls ignore `unset`, unlike the enum select
- where: packages/ui/src/components/Properties/FontControls.tsx:5-37 (FontFamilyControl, FontWeightControl)
- scenario: `<PropertyField kind="font-family" unset …>`.
  - EnumControl's select shows `—` while unset (`EnumControl.tsx:107`), per the `PropertyFieldBase.unset` contract in `fieldTypes.ts`.
  - The font Selects pass neither `placeholder` nor `unset`. An unset font row shows Select's generic placeholder instead of the dash, and if it is given a fallback `value`, it shows that value as chosen.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Properties/ColorControls.tsx
packages/ui/src/components/Properties/CurveField.module.css
packages/ui/src/components/Properties/CurveField.stories.tsx
packages/ui/src/components/Properties/CurveField.tsx
packages/ui/src/components/Properties/CurveMarks.tsx
packages/ui/src/components/Properties/DialogRow.stories.tsx
packages/ui/src/components/Properties/DialogRow.tsx
packages/ui/src/components/Properties/EnumControl.tsx
packages/ui/src/components/Properties/FontControls.tsx
packages/ui/src/components/Properties/NumberControls.tsx
packages/ui/src/components/Properties/Properties.gallery.stories.module.css
packages/ui/src/components/Properties/Properties.gallery.stories.tsx
packages/ui/src/components/Properties/Properties.metrics.stories.module.css
packages/ui/src/components/Properties/Properties.metrics.stories.tsx
packages/ui/src/components/Properties/Properties.module.css
packages/ui/src/components/Properties/PropertyAutoReadout.stories.tsx
packages/ui/src/components/Properties/PropertyAutoReadout.tsx
packages/ui/src/components/Properties/PropertyCaption.tsx
packages/ui/src/components/Properties/PropertyControl.stories.tsx
packages/ui/src/components/Properties/PropertyField.stories.module.css
packages/ui/src/components/Properties/PropertyField.stories.tsx
packages/ui/src/components/Properties/PropertyField.tsx
packages/ui/src/components/Properties/PropertyGroup.css
packages/ui/src/components/Properties/PropertyGroup.stories.tsx
packages/ui/src/components/Properties/PropertyGroup.tsx
packages/ui/src/components/Properties/PropertyHelp.module.css
packages/ui/src/components/Properties/PropertyHelp.stories.tsx
packages/ui/src/components/Properties/PropertyHelp.tsx
packages/ui/src/components/Properties/PropertyList.css
packages/ui/src/components/Properties/PropertyList.stories.module.css
packages/ui/src/components/Properties/PropertyList.stories.tsx
packages/ui/src/components/Properties/PropertyList.tsx
packages/ui/src/components/Properties/PropertyNote.stories.tsx
packages/ui/src/components/Properties/PropertyPanel.css
packages/ui/src/components/Properties/PropertyPanel.stance.css
packages/ui/src/components/Properties/PropertyPanel.stories.module.css
packages/ui/src/components/Properties/PropertyPanel.stories.tsx

<!-- done: 7 findings, files read: 37 -->