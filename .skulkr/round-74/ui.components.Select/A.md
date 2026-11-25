# Audit round 74 — ui.components.Select (blind reviewer)

## `width='fit'` sizer ignores `--wzl-select-weight`, so a bold value truncates its widest option
- where: packages/ui/src/components/Select/Select.module.css:45 (`.value` font-weight) and :200 (`.sizer`)
- scenario: `PropertyRow.inline.css:89` sets `--wzl-select-weight: bold` on selects in a property row. `.value` takes that weight; `.sizer` (the hidden stack of labels sharing its grid cell) does not, so it measures every label at the trigger's regular weight. A `width='fit'` select there sizes to the regular-weight widest label, and when that option is selected its bold rendering overflows and is cut with an ellipsis. The sizer should carry the same `font-weight` as `.value`.
- evidence: read
- severity: medium

## `width='fit'` with no `placeholder` doesn't size for React Aria's default placeholder text
- where: packages/ui/src/components/Select/Select.tsx:205-209 (`SelectValue` render) and :210 (`FitSizer placeholder={placeholder}`)
- scenario: `<Select width="fit" options={[{value:'r',label:'Red'}]} />` with nothing selected and no `placeholder`. The trigger shows `defaultChildren`, React Aria's localized "Select an item", but `FitSizer` gets `placeholder === undefined` and only measures "Red". The trigger is sized to "Red", so the placeholder gets cut to "Sel…". It should measure whatever the trigger actually shows, or the default text should also go into the sizer.
- evidence: read
- severity: low

## The re-measure cap never resets while the list is open, so options that change after a few passes stay misaligned
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:53-59 (`passes`, `AlignOverTrigger`)
- scenario: `passes` only goes up while the popover is mounted, and once it passes 3 the effect returns before doing anything, including the `BELOW` branch that clears `data-align`. Options that change while the list is open (`useFontFamilyOptions` rebuilds each time a face lands, as in `Select.fontOptions.stories.tsx`) move the selected row, or remove it. After a few such changes the list is no longer realigned: the selected row drifts off the trigger, or a list with no selection keeps the old over-trigger offset and its `data-align`, which also drops its `min-width`. The cap should limit passes per change in layout or options, not per open.
- evidence: read
- severity: low

## Changing `gestures.dragPx` / `longPressMs` while the list is open re-arms the swallow of the next pointerup
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:116-135 (pointerup effect)
- scenario: The effect depends on `[triggerRef, pressRef, dragPx, holdMs]`. Once the opening release has been eaten, the listener removes itself. If either kit setting changes while the list is still open, the effect runs again and adds a new capturing `pointerup` listener. `pressRef` still holds the opening press. If the next release on a row comes within `holdMs` of that press and inside the drag threshold, it is swallowed and a synthetic `pointercancel` is sent, so that click picks nothing. Whether the opening release has been spent should not reset when the settings change.
- evidence: read
- severity: low

## `--wzl-select-align: center` lines the list up on the left edge while the value is centered
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:73-76 (`toRight`)
- scenario: `.value` uses `text-align: var(--wzl-select-align, start)`, so a surface may set `center`. `toRight` only handles `right`/`end`/`start`/empty, so `center` falls into the left-edge branch. The selected row's label starts at the left edge of the value box, while the trigger's text sits in the middle. The row lands beside the value, not on it, which undoes the "choosing what is chosen moves nothing" promise. Either center is handled (match the centers), or the hook documents that it only accepts start/end/left/right.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Select/Select.fontOptions.stories.module.css
packages/ui/src/components/Select/Select.fontOptions.stories.tsx
packages/ui/src/components/Select/Select.module.css
packages/ui/src/components/Select/Select.stories.module.css
packages/ui/src/components/Select/Select.stories.tsx
packages/ui/src/components/Select/Select.tsx
packages/ui/src/components/Select/alignOverTrigger.tsx
packages/ui/src/components/Select/index.ts
packages/ui/src/components/Select/listbox.module.css
packages/ui/src/components/Select/optionLabels.tsx

<!-- done: 5 findings, files read: 10 -->
