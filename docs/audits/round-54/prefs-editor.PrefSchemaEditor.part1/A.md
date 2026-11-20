I couldn't write `.skulk/out/findings.md` because the write was denied, so here is the whole findings document. One more discrepancy: the brief names frozen commit `608f35f5…`, but this checkout doesn't have that object (`git cat-file` fails). HEAD is `830b463cc1`, and the line numbers below are from that tree.

# Findings: prefs-editor.PrefSchemaEditor.part1

## PrefSchemaEditor's Submit turns on for changes that only touch the action catalog, lists them, then submits an empty change list
- where: packages/prefs-editor/src/PrefSchemaEditor/PrefSchemaEditor.tsx:105 (`submit`), with AssetEditor.tsx:213 (`changes={changedAssets.all}`)
- scenario: A `PrefSchemaEditor` has `actions` and `onSubmit`, and the reader only re-sorts or regroups the Actions list. `changedAssets.all` (useAssetChanges.ts:69) flattens every asset's changes, including the catalog's. So ExportPanel's Submit button turns on, and the Changes tab lists the catalog's changes under asset headings. Pressing Submit calls `onSubmit([], printSchema(schema))`: the host gets an empty change list and an unchanged literal, and the button reads "Sent". The prop doc (PrefSchemaEditor.tsx:56) and the comment at :104 say a submission holds only the schema's changes, and that the catalog reaches the host through `onActionCatalogChange`. Submit should stay off, and the list empty, while the schema itself has no changes.
- evidence: read
- severity: medium

## IdentityForm places the node's glyph on the wrong side in right-to-left layouts
- where: packages/prefs-editor/src/PrefSchemaEditor/IdentityForm.tsx:29-30 (`measure`), with PrefSchemaEditor.module.css:256 (`inset-inline-end: var(--identity-end)`)
- scenario: The offset is measured from physical right edges: `slot.right - paddingInlineEnd` and `at.right - right`. It is then applied as `inset-inline-end`, which is the left side under `dir="rtl"`. In an RTL host (the kit supports one: IconPicker reads `inlineDirection`), `paddingInlineEnd` is the left padding, and the distance is still taken from the right edge. So `--identity-end` gets the wrong length for the side it is applied to. The glyph comes loose from the edge the other rows' controls end at, and can cover the name and description fields. In RTL the measurement should come from the left edges: `(slot.left + paddingInlineEnd) - at.left`.
- evidence: read
- severity: low

## Files read
packages/prefs-editor/src/PrefSchemaEditor/ActionList.tsx
packages/prefs-editor/src/PrefSchemaEditor/AddNodeDialog.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.demo.ts
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.fixture.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.stories.module.css
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.stories.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetEditor.tsx
packages/prefs-editor/src/PrefSchemaEditor/AssetList.module.css
packages/prefs-editor/src/PrefSchemaEditor/AssetList.tsx
packages/prefs-editor/src/PrefSchemaEditor/AttributesPane.tsx
packages/prefs-editor/src/PrefSchemaEditor/BundlePreview.module.css
packages/prefs-editor/src/PrefSchemaEditor/BundlePreview.tsx
packages/prefs-editor/src/PrefSchemaEditor/EditorBar.tsx
packages/prefs-editor/src/PrefSchemaEditor/EditorNotice.tsx
packages/prefs-editor/src/PrefSchemaEditor/ExportPanel.tsx
packages/prefs-editor/src/PrefSchemaEditor/IconAttrField.module.css
packages/prefs-editor/src/PrefSchemaEditor/IconAttrField.tsx
packages/prefs-editor/src/PrefSchemaEditor/IconPicker.module.css
packages/prefs-editor/src/PrefSchemaEditor/IconPicker.tsx
packages/prefs-editor/src/PrefSchemaEditor/IdentityForm.tsx
packages/prefs-editor/src/PrefSchemaEditor/NodeGhost.tsx
packages/prefs-editor/src/PrefSchemaEditor/NumberText.tsx
packages/prefs-editor/src/PrefSchemaEditor/Palette.tsx
packages/prefs-editor/src/PrefSchemaEditor/PaneHeader.tsx
packages/prefs-editor/src/PrefSchemaEditor/PartsList.tsx
packages/prefs-editor/src/PrefSchemaEditor/PrefSchemaEditor.module.css
packages/prefs-editor/src/PrefSchemaEditor/PrefSchemaEditor.stories.module.css
packages/prefs-editor/src/PrefSchemaEditor/PrefSchemaEditor.stories.tsx
packages/prefs-editor/src/PrefSchemaEditor/PrefSchemaEditor.tsx
packages/prefs-editor/src/PrefSchemaEditor/PreviewPane.tsx
packages/prefs-editor/src/PrefSchemaEditor/SettingsTree.tsx
packages/prefs-editor/src/PrefSchemaEditor/Shelf.tsx
packages/prefs-editor/src/PrefSchemaEditor/StoredArea.tsx
packages/prefs-editor/src/PrefSchemaEditor/StructurePane.tsx
packages/prefs-editor/src/PrefSchemaEditor/StructureTools.tsx
packages/prefs-editor/src/PrefSchemaEditor/UnitAttr.tsx

<!-- done: 2 findings, files read: 36 -->