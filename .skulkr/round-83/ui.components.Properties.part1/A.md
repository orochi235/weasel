# Audit round 83 — ui.components.Properties.part1

## A `<PropertyNote>` inside a `<PropertyGroup pack="pairs">` fills one column, not both
- where: packages/ui/src/components/Properties/PropertyGroup.css:36 (`.groupBody.groupPairs > *`)
- scenario: `<PropertyGroup pack="pairs"><PropertyNote>…</PropertyNote><PropertyField …/>…</PropertyGroup>` → `.groupBody.groupPairs > *` (0,2,0) sets `grid-column: auto`, which beats `.note { grid-column: 1 / -1 }` (0,1,0), so the note takes half the row and pairs with the next field. `PropertyNote`'s doc says it "spans both columns of the grid", and in `.listPairs` it does, because `.listPairs > *` never sets `grid-column`. The span list at lines 41–45 names `h3`, `.span` and `.subpanel` but not `.note`. It should span: add `.groupBody.groupPairs > .note`.
- evidence: read (specificity worked out from the CSS; not rendered)
- severity: low

## Two identical curve marks share a React key
- where: packages/ui/src/components/Properties/CurveMarks.tsx:31 and :55 (`CurveMarks`)
- scenario: `marks={[{kind:'line', x:0.5}, {kind:'line', x:0.5}]}`, or two bands with the same range and color → both get the key `mark-0.5-#ffcc00`. React warns about the duplicate key and can reuse or drop one element when the list changes. The keys come only from the mark's content, so nothing makes them unique; including the index would.
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

<!-- done: 2 findings, files read: 37 -->
