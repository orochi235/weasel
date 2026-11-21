I couldn't save `.skulkr/out/findings.md`: writing it needed a permission that was never granted. As the brief allows, the whole findings document follows here instead.

# Audit round 59 — ui.components.Prefs.part1

## The columns layout keys each column by its index, so a column appearing or disappearing remounts every column after it
- where: packages/ui/src/components/Prefs/PrefsForm.tsx:307 (FlatLayout)
- scenario: In the default `layout="columns"`, a top-level group A has `showIf` reading a switch in group B, which comes after it. Turning the switch on adds A to `applied.shown`, so B moves from column index 0 to index 1. The wrapper `<div key={i}>` at index 0 now holds a different keyed child, so React unmounts B's whole subtree and mounts a new one. Keyboard focus on the switch the reader just pressed is lost, and so is local row state in every later column: a `GroupTabs`' own open tab, a `MapEditor` row still being typed with an empty key, half-typed text waiting out `textWaitMs`. The same happens on every change of drop target while a drag reorders top-level groups. The wrapper should take the child's own key (`child.key`), not the index.
- evidence: read
- severity: medium

## A text list adds new entries as '' and reads non-string entries as '', where every other list uses the item's default
- where: packages/ui/src/components/Prefs/ListLeaf.tsx:18 (prefListTexts), :29 (PrefTextList), :64 (ListLeaf, text branch); contrast :37 (prefListEntry) and :70 (`newEntry={() => item.default}`)
- scenario: Take `{ kind: 'list', item: { kind: 'string', name: 'Tag', default: 'untitled' } }`. With no string renderer and no `textarea`, it goes through `PrefTextList`. `PrefTextListProps` picks no `newEntry`, so `ListEditor` falls back to `() => ''`, and Add creates `''` instead of `'untitled'`. `prefListTexts` also turns any `undefined` or `null` entry into `''`. Because every edit commits the whole array, editing one entry permanently writes `''` over the entries that held nothing. The generic branch, and `prefListEntry`'s own doc ("one holding nothing is the item's default, which is what a new entry starts as"), answer both questions with `item.default`. labkit's `ControlRow` goes through the same `PrefTextList`, so it inherits the gap.
- evidence: read
- severity: low

## A group whose description is '' draws an empty description paragraph in the rail layout, but not in the columns layout
- where: packages/ui/src/components/Prefs/PrefsPane.tsx:65 (PrefsPane), :165 (PaneSection), :273 (PaneTabs); contrast PrefsForm.tsx:331 (GroupBody, `group.description || undefined`)
- scenario: `PrefGroup.description` is optional, and prefs-editor builds groups with `description: ''` (for example `addNode(tree, 'pkg', 'fresh', { name: 'Fresh', description: '', children: {} })`). In `layout="rail"` the pane, each section and each tab test `description !== undefined`, so each draws an empty `<p class="paneDesc">` under its heading, taking up space in the flex gap. The columns layout treats `''` as having no description, and `PrefLabelLine` tests `!== ''`. The same question gets two answers.
- evidence: read
- severity: low

## The NotSplit story says its row shows marks and opens to a control per option, but with nothing stored it shows neither
- where: packages/ui/src/components/Prefs/Prefs.split.stories.tsx:70 (NotSplit)
- scenario: The story stores nothing for `panel.gap`, so `split.scopes.get('panel.gap')` is `undefined`. In `splitShape`, `prefStoredSelectors(undefined)` is empty, every axis is skipped by `!by.has(path)`, and it returns `null`. `splitRowState` then returns `null`: no marks and no toggle. `opens` is just `members`, which needs a stored scope; the split/join offer the blurb describes was removed in 99d2c009ed. The story shows a plain row while its blurb says "the row marks the option each selector is set to, and opens to a control per option".
- evidence: read
- severity: low

## The PrefsRail stories have no nested pages, so Foldable has nothing to fold
- where: packages/ui/src/components/Prefs/PrefsRail.stories.tsx:13 (SCHEMA), :54 (Foldable)
- scenario: `snapping` and `wrap` set no `as`, so they are sections. `prefRailItems` only lists nested groups with `as: 'page'` (`prefGroupOpensPage`), so `ITEMS` holds only `canvas` and `io`, both at depth 0. Default's blurb ("followed by those of the pages nested in it") and Foldable's ("Nested pages fold away…") describe behavior the story cannot show: no entry has a fold mark.
- evidence: read
- severity: low

## The AllKinds badge story claims every built-in kind but leaves six out
- where: packages/ui/src/components/Prefs/PrefKindBadge.stories.tsx:16 (KINDS), :19 (AllKinds)
- scenario: The blurb reads "Every built-in kind, then a custom kind and a group", but `KINDS` leaves out `list`, `map`, `union`, `action`, `actions` and `alias`. Four of those have their own colors in `KIND_CLASS` and `PrefKindBadge.module.css`, and none of the four is ever shown.
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
packages/ui/src/components/Prefs/Prefs.module.css
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

<!-- done: 6 findings, files read: 40 -->