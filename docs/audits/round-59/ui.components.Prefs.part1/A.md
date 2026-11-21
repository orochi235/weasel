# Audit round 59 — ui.components.Prefs.part1

## PrefsForm ignores a `renderers` key naming a leaf's path for every row, object field and bar cell it draws
- where: packages/ui/src/components/Prefs/PrefsRow.tsx:187 (LeafRow), :294 (rowIsGroup); also renderPrefControl → renderLeafControl (renderLeaf.tsx:144) used by PrefsRow.tsx:257/280, PrefsPane.tsx:200 (PaneBar cells) and PrefControl.tsx:40
- scenario: `PrefsFormProps.renderers` documents "a key that is a leaf's path overrides that leaf alone", and `warnUnmatchedRenderers` treats a path key as matched (no warning). `<PrefsForm schema={pref.group('', { size: pref.number('Size', 1) })} renderers={{ size: draw }} />` still draws the built-in number control: `LeafRow` looks up `rendererOf(ctx.renderers, pref.kind)` with the kind only, and so do `rowIsGroup`, `rowWidthOf` (compound.ts:13) and `renderLeafControl`, which an object leaf's fields and an `as: 'bar'` group's cells go through. Only list/map entries (`renderNestedLeaf`, renderLeaf.tsx:67) honor the path. The same question is answered path-first in PanelCells (cells.tsx:60, panelCells.ts:102, objectField.tsx:35) and PrefsBar (PrefsBar.tsx:172), so one renderers map draws a leaf differently in PrefsForm than in a panel or a standalone bar. Should: look up `rendererOf(renderers, path, kind)` everywhere a form picks a renderer.
- evidence: read
- severity: high

## A group whose `description` is `''` draws an empty description paragraph in a rail pane, a section and a tab, but none in the columns layout
- where: packages/ui/src/components/Prefs/PrefsPane.tsx:65 (PrefsPane), :165 (PaneSection), :273 (PaneTabs); :239 (PanePanel passes `note={group.description}` as is)
- scenario: `PrefGroup.description` is optional, and the schema editor's own trees write `description: ''` (prefs `edit/bundleTree.ts:188`; the group attrs' `description` is a text field a reader can clear). Such a group drawn in `layout="rail"` gets `<p class="paneDesc"></p>` under its heading — an empty block carrying the paragraph's margin — because PrefsPane tests `!== undefined`. The same group in the columns/list layout draws no note: `GroupBody` passes `group.description || undefined` (PrefsForm.tsx:331), and ObjectLeaf's `lead` tests truthiness (ObjectLeaf.tsx:70). One question, "does this group have a description to show", answered two ways; should test for a non-empty string in every place.
- evidence: read
- severity: low

## The NotSplit story says a scoped pref with nothing stored marks its selectors and opens to a control per option; it draws a plain row
- where: packages/ui/src/components/Prefs/Prefs.split.stories.tsx:69 (NotSplit)
- scenario: The story's blurb reads "A scoped pref with nothing stored: the row marks the option each selector is set to, and opens to a control per option." With `held: {}`, `store.scopes()` has no entry for `panel.gap`, so `splitShape` (splitRows.ts:114) gets `prefStoredSelectors(undefined)` = empty, `by.has(path)` skips every axis, and it returns null; `splitRowState` returns null, so `LeafRow` draws no marks and no `SplitToggle`. PrefsForm.split.test.tsx:63 pins exactly that ("draws no marker for a leaf that is not split"). The story describes behavior the code does not have; it should say the row draws as an unscoped leaf until a value is split.
- evidence: read
- severity: low

## The PrefsRail stories' schema has no nested page, so Foldable folds nothing and Default shows no nested entries
- where: packages/ui/src/components/Prefs/PrefsRail.stories.tsx:6 (SCHEMA), :48 (Default), :53 (Foldable)
- scenario: Default's blurb is "Each page's entry, followed by those of the pages nested in it" and Foldable's is "Nested pages fold away until the open page is the one holding them". The schema's only nested groups (`canvas.snapping`, `canvas.snapping.wrap`) leave `as` unset, so they are sections (`prefGroupOpensPage` needs `as: 'page'`, schema.ts:70) and `prefRailItems` lists just `canvas` and `io`, both at depth 0. `nests` holds no item's path, no `Disclosure` is drawn, and toggling `foldable` changes nothing visible. The stories demonstrate neither claim; `snapping` needs `as: 'page'` for them to.
- evidence: read
- severity: low

## PrefKindBadge's AllKinds story claims every built-in kind but leaves out list, map, union, action and actions
- where: packages/ui/src/components/Prefs/PrefKindBadge.stories.tsx:16 (KINDS), :18 (AllKinds)
- scenario: The blurb says "Every built-in kind, then a custom kind and a group". `KINDS` lists number, boolean, string, enum, color, paint, object, field, then the custom ones; `KIND_CLASS` (PrefKindBadge.tsx:5) gives list, map, union, action and actions colors of their own (PrefKindBadge.module.css:12–15), none of which the story draws. Should list every key of `KIND_CLASS` that has a class.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Prefs/ActionLeaf.stories.tsx
packages/ui/src/components/Prefs/ActionLeaf.tsx
packages/ui/src/components/Prefs/ActionsLeaf.stories.tsx
packages/ui/src/components/Prefs/ActionsLeaf.tsx
packages/ui/src/components/Prefs/BarRootLayout.tsx
packages/ui/src/components/Prefs/GroupTabs.stories.tsx
packages/ui/src/components/Prefs/GroupTabs.tsx
packages/ui/src/components/Prefs/ListLeaf.tsx
packages/ui/src/components/Prefs/MapEditor.module.css
packages/ui/src/components/Prefs/MapEditor.stories.tsx
packages/ui/src/components/Prefs/MapEditor.tsx
packages/ui/src/components/Prefs/NoMatches.tsx
packages/ui/src/components/Prefs/ObjectLeaf.tsx
packages/ui/src/components/Prefs/PrefControl.tsx
packages/ui/src/components/Prefs/PrefKindBadge.module.css
packages/ui/src/components/Prefs/PrefKindBadge.stories.tsx
packages/ui/src/components/Prefs/PrefKindBadge.tsx
packages/ui/src/components/Prefs/PrefLabelLine.stories.tsx
packages/ui/src/components/Prefs/PrefMixed.module.css
packages/ui/src/components/Prefs/PrefMixed.stories.tsx
packages/ui/src/components/Prefs/PrefMixed.tsx
packages/ui/src/components/Prefs/PrefWords.module.css
packages/ui/src/components/Prefs/PrefWords.tsx
packages/ui/src/components/Prefs/Prefs.across.stories.tsx
packages/ui/src/components/Prefs/Prefs.heading.stories.tsx
packages/ui/src/components/Prefs/Prefs.kinds.stories.tsx
packages/ui/src/components/Prefs/Prefs.split.stories.tsx
packages/ui/src/components/Prefs/Prefs.stories.module.css
packages/ui/src/components/Prefs/Prefs.stories.tsx
packages/ui/src/components/Prefs/PrefsDialog.tsx
packages/ui/src/components/Prefs/PrefsForm.tsx
packages/ui/src/components/Prefs/PrefsPane.stories.tsx
packages/ui/src/components/Prefs/PrefsPane.tsx
packages/ui/src/components/Prefs/PrefsRail.stories.tsx
packages/ui/src/components/Prefs/PrefsRail.tsx
packages/ui/src/components/Prefs/PrefsRow.tsx
packages/ui/src/components/Prefs/RailLayout.tsx
packages/ui/src/components/Prefs/Split.module.css
packages/ui/src/components/Prefs/SplitRow.tsx

<!-- done: 5 findings, files read: 39 -->
