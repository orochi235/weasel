## A slider's editable readout stringifies `format`'s ReactNode, where the read-only readout renders it
- where: packages/ui/src/components/Properties/NumberControls.tsx:301 (EditableReadout `text`)
- scenario: `format` is typed `(value) => ReactNode` (fieldTypes.ts:121) and `PropertyReadout.tsx:76` renders its result as a node. The slider's readout runs it through `String(format(n))`, so a format returning an element (`v => <>{v}<sub>px</sub></>`) shows `[object Object]` in the box, in `aria-valuetext`, and sizes `--wzl-property-readout-fit` from that string. The same prop is answered two ways: rendered in the read-only readout, stringified in the slider's.
- evidence: read
- severity: medium

## Typing `-` in a slider readout moves the caret to the end
- where: packages/ui/src/components/Properties/NumberControls.tsx:338 (EditableReadout input `onChange`)
- scenario: The draft is stored with every `-` replaced by `−`. That makes the controlled value differ from what the DOM holds, so React writes it back and the caret jumps to the end. Example: the box reads `12`, the user puts the caret before `1` and types `-`. The text becomes `−12` with the caret after `2`, not after `−`, so the next keystroke lands in the wrong place.
- evidence: read (React's behavior when a controlled value differs from the DOM value)
- severity: low

## A paired PropertyGroup body lets a wide row widen its column, where a paired list does not
- where: packages/ui/src/components/Properties/PropertyGroup.css:35 (`.groupBody.groupPairs > *`)
- scenario: The comment says these rows behave "as a paired list's rows", and `.listPairs > *` (PropertyList.css:31) sets `min-width: 0` so a `1fr` track can shrink below its content. The group rule leaves that out. In `<PropertyGroup pack="pairs">`, a row with a long label or a wide control keeps its min-content width, so one column grows, the pair goes uneven, and the group overflows a narrow sidebar. The same rows inside `<PropertyList pack="pairs">` shrink.
- evidence: read
- severity: low

## CurveMarks keys collide for two identical marks
- where: packages/ui/src/components/Properties/CurveMarks.tsx:30,57 (CurveMarks)
- scenario: Keys are built only from x and color. Two marks at the same x with no color (for example two landmarks that coincide) get the same key: React warns about duplicate keys, and when the marks list changes it can reuse or drop the wrong element.
- evidence: read
- severity: low

## The PropertyPanel story's `pack` control cannot select `one-up`
- where: packages/ui/src/components/Properties/PropertyPanel.stories.tsx:25 (meta.argTypes.pack)
- scenario: `PropertyListPack` is `'auto-color' | 'pairs' | 'one-up'`, but the control offers only the first two. `satisfies` checks only that the listed options are valid, not that all are listed. The control's description also covers only those two, so `one-up` packing cannot be shown from the stories' controls.
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

<!-- done: 5 findings, files read: 37 -->
