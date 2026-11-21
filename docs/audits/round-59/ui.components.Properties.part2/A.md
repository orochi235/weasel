I couldn't save the last version of the findings file: writing to `.skulkr/out/findings.md` now needs a permission that hasn't been granted. The copy on disk is an earlier draft with 5 of the 6 findings; it is missing the slider-help finding, the files-read list and the done marker. The full document is below.

# Audit round 59 — ui.components.Properties.part2

## An auto row's label toggle still pins or unpins inside a read-only scope
- where: packages/ui/src/components/Properties/PropertyRow.tsx:125 (PropertyRow → AutoToggle, line 252)
- scenario: a `<PropertyPanel readOnly>` (or `<ReadOnly>`) holds a row whose `RowScope` gives `onAutoChange`. Clicking the label, or pressing Enter or Space on it, calls `onAutoChange(!auto)` and changes the setting. AutoToggle checks only `useDisabled(props)`, which covers a disabled scope but not a read-only one. `ResetControl` in the same row head checks `useControlAccess().state !== 'enabled'` ("a reset changes the value, so a disabled or read-only scope stops it too"). So the one row gives two answers to "may this change the value": reset is blocked, the auto toggle is not. While read-only, the toggle should ignore presses and leave the tab order.
- evidence: read
- severity: medium

## A textarea or slider readout disabled with a reason is not dimmed
- where: packages/ui/src/components/Properties/PropertyRow.variants.css:149 (`.textarea:disabled, .readoutInput:disabled`); also PropertyRow.css:203 (`.readoutInput:hover:not(:disabled)`)
- scenario: `StringControl`'s textarea and `EditableReadout`'s input get their disabled state from `useNativeHold`. For a control disabled *with a reason* (`access.reachable`), that hook sets `aria-disabled` and `data-disabled` and leaves native `disabled` off, so the control stays focusable for the reason tooltip. These rules match only `:disabled`. So `<PropertyField kind="string" control="textarea" disabled disabledReason="Locked">`, or a slider disabled with a reason, draws its textarea at full strength with the text cursor, and the readout still shows its hover background. The row dims only its label ("the control dims itself"), so nothing dims the textarea. Every other kit control matches `:is(:disabled, [data-disabled])` (Button, Segmented, InlineRange's `.range:where(:disabled, [data-disabled])`), and these rules should too.
- evidence: read
- severity: medium

## A described slider row never opens its help from the keyboard, and puts the description on a track no one can Tab to
- where: packages/ui/src/components/Properties/rowHelp.ts:50 and :67 (useRowHelp: `describe`, `onFocus`)
- scenario: `<PropertyField kind="number" control="slider" label="Size" description="…">` in its default stacked layout.
  - The slider's only tab stop is the editable readout, a spinbutton; `SliderTrack` gets `tabIndex={-1}` unless the readout was replaced.
  - `SliderRow` passes that readout as the row's `readout`, and `PropertyRow` draws it inside `.rowLabel`. That element is the cue's parent, which `useRowHelp` calls `own`.
  - `describe` skips everything inside `own`, so `aria-describedby` goes on the range input instead.
  - `onFocus` returns early for any focus target inside `own`, so tabbing to the readout never starts the help's timer.
  - A keyboard or screen-reader user therefore gets neither the tooltip nor the description on the control they are on. Opening help for the keyboard is what the hook is for ("the help opens when the keyboard brings focus to a control in the row").
  - In inline layout the readout moves after the control, so the help does open, but the description is still on the track rather than the focused spinbutton.
  - `own` is meant to exclude the row's own parts (label, auto toggle, reset). The readout is the row's control and should not be excluded.
- evidence: read (traced through PropertyHelp's bare cue, PropertyRow's head, NumberControls' SliderRow/SliderTrack)
- severity: medium

## A color row's error message draws on top of its opacity track, or its swatch when stacked
- where: packages/ui/src/components/Properties/PropertyRow.message.css:22 (`.rowColor > .rowError`)
- scenario: a `kind="color"` field with `alpha`, in a row whose `RowScope` gives an `error`. `.rowColor > .colorField` is `display: contents`. variants.css puts the opacity track at `grid-row: 2; grid-column: 1` and its readout at `grid-row: 2; grid-column: 2`. The error is placed explicitly at `grid-column: 1 / -1; grid-row: 2`, so it draws over the track and readout instead of on a line below them. With `layout="block"` the swatch is at `grid-row: 2` and the track at 3, so the message covers the swatch. The error should go below the last grid row the variant uses.
- evidence: read
- severity: medium

## A read-only color field whose alpha is held separately shows no alpha
- where: packages/ui/src/components/Properties/PropertyReadout.tsx:42 (readoutBody, `case 'color'`)
- scenario: `<PropertyField kind="color" value="#ff0000" alpha={0.5} readOnly …>`. When `alpha` is a number, the editable `ColorControl` keeps it separate from the hex (`apart = typeof p.alpha === 'number'`) and draws the opacity. The readout draws only `p.value`, so the read-only field shows `#ff0000` with an opaque swatch. Its docstring says it shows the words the control would show. The swatch and text should carry the 0..1 alpha.
- evidence: read
- severity: low

## A read-only field's value can't be selected in Safari
- where: packages/ui/src/components/Properties/PropertyReadout.module.css:12 (`.readout`)
- scenario: `PropertyReadout` sits inside a `.row`, which family.css sets to `-webkit-user-select: none; user-select: none`. family.css then turns selection back on for "what the family shows as a value", setting both the prefixed and unprefixed property; its comment names Safari. The readout's own module class sets only the unprefixed `user-select: text`. family.css's `.readout` rule doesn't help: it names the family module's `.readout`, not this module's scoped class. Safari reads `-webkit-user-select`, so a read-only field's `<output>` keeps the row's `none`, and its value (an id, a hex) can't be selected or copied. The fix is to add `-webkit-user-select: text` next to it.
- evidence: read (that Safari needs the prefix is inferred from family.css's own comment)
- severity: low

## Files read
packages/ui/src/components/Properties/PropertyPanel.tsx
packages/ui/src/components/Properties/PropertyReadout.module.css
packages/ui/src/components/Properties/PropertyReadout.stories.tsx
packages/ui/src/components/Properties/PropertyReadout.tsx
packages/ui/src/components/Properties/PropertyRow.auto.css
packages/ui/src/components/Properties/PropertyRow.css
packages/ui/src/components/Properties/PropertyRow.fit.css
packages/ui/src/components/Properties/PropertyRow.inline.css
packages/ui/src/components/Properties/PropertyRow.message.css
packages/ui/src/components/Properties/PropertyRow.stories.module.css
packages/ui/src/components/Properties/PropertyRow.stories.tsx
packages/ui/src/components/Properties/PropertyRow.tsx
packages/ui/src/components/Properties/PropertyRow.variants.css
packages/ui/src/components/Properties/ResetControl.css
packages/ui/src/components/Properties/ResetControl.tsx
packages/ui/src/components/Properties/RowScope.stories.tsx
packages/ui/src/components/Properties/Subpanel.css
packages/ui/src/components/Properties/Subpanel.stance.css
packages/ui/src/components/Properties/Subpanel.stories.module.css
packages/ui/src/components/Properties/Subpanel.stories.tsx
packages/ui/src/components/Properties/Subpanel.tsx
packages/ui/src/components/Properties/collapse.ts
packages/ui/src/components/Properties/family.css
packages/ui/src/components/Properties/fieldControls.tsx
packages/ui/src/components/Properties/fieldTypes.ts
packages/ui/src/components/Properties/index.ts
packages/ui/src/components/Properties/layouts.story.module.css
packages/ui/src/components/Properties/layouts.story.tsx
packages/ui/src/components/Properties/metrics.ts
packages/ui/src/components/Properties/nameOf.ts
packages/ui/src/components/Properties/rowHelp.ts
packages/ui/src/components/Properties/rowScope.tsx
packages/ui/src/components/Properties/sliderScale.ts
packages/ui/src/components/Properties/sliderStops.ts
packages/ui/src/components/Properties/unitAttach.css
packages/ui/src/components/Properties/unitSuffix.tsx

<!-- done: 6 findings, files read: 36 -->