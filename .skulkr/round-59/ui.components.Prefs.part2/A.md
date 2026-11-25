I couldn't save the findings file. The first `Write` created `.skulkr/out/findings.md` with one finding, but every later write to it (`Write`, `Edit` and a shell append) was refused because permission was never granted. As the brief allows, the whole document is below.

# Audit round 59 — ui.components.Prefs.part2

## A bar section's nested run is keyed `<object>.<key>`, not by its section path, so two nested sections sharing a key collide
- where: packages/ui/src/components/Prefs/objectRows.tsx:142 (barNodes)
- scenario: take an object leaf `o` with an `as: 'bar'` section holding sections `a: { members: { x: {section…} } }` and `b: { members: { x: {section…} } }`. Both runs get the path `o.x`. `barNodeChildren` then emits two `BarDivider`s keyed `o.x:before` and two keyed `o.x:after`, and uses `o.x` as the container for both runs' items. React warns about the duplicate keys and may reuse or misplace the dividers, and a bar's `onReorder` sees one container for two runs. The run path also disagrees with how `drawnChildren` names a section (`prefSectionPath(within, key)` → `o.#a`), so `barAttrs` and `off` can't address it. The path should be built from the enclosing section's path with `prefSectionPath`, as `drawnChildren` does.
- evidence: read
- severity: low

## UnionPicker's variant select offers an "Unset" entry that does nothing
- where: packages/ui/src/components/Prefs/UnionPicker.tsx:29 (UnionPicker, `clearable: true` + `setValue`)
- scenario: the synthesized `choice` enum is `clearable: true`. So `enumFieldProps` gives it `onClear: () => setValue(undefined)`, and `EnumControl` adds an `Unset` option (`EnumControl.tsx:24`) or allows deselect on segments. Picking it calls `setValue(undefined)`, which UnionPicker drops (`typeof key === 'string'`). The control offers a choice that silently writes nothing and snaps back to the current variant.
- evidence: read
- severity: low

## `warnUnmatchedRenderers` puts section keys into object-leaf field paths, so a correct path-keyed renderer for a field in a section is warned about as a typo
- where: packages/ui/src/components/Prefs/unmatchedRenderers.ts:14-16 (pathsAndKinds)
- scenario: take an object leaf `stroke` with a section `geometry: { members: { width } }`. The field's real path is `stroke.width`, because a section key is not a path segment (`prefSectionLeaves`, `objectFieldContext`, `prefFieldChoices`), and `renderNestedLeaf` looks the renderer up by that path. The walk adds every `children`/`members` key, so it records `stroke.geometry.width`. As a result `renderers: { 'stroke.width': … }`, which does draw, gets the dev warning "neither a leaf path nor a leaf kind… Check … for a typo". The wrong key `stroke.geometry.width` passes silently. Nested sections in a `PrefSection` root behave the same way.
- evidence: read
- severity: low

## A union's variant fields wrap `update` to restore the tag but not `drafts`
- where: packages/ui/src/components/Prefs/renderLeaf.tsx:117-126 (renderLeaf, union branch)
- scenario: the context handed to `parts.object` wraps `update` to add `[union.tag]: key`. That covers a target not yet holding an object, which is built from the variant's untagged default. The context spreads `...ctx` and keeps the union's own `drafts`, and `objectFieldContext` builds the draft writer with `through(ctx.drafts.update)`. That writer stores `prefObjectWithField(variant, variant.default, …)` with no tag. On a panel, where sliders are live through drafts, each draft frame of a slider drag on such a target writes an untagged object. `prefVariantOf` then returns undefined, so `UnionPicker` stops drawing the fields and the slider being dragged unmounts.
- evidence: read (reasoned from `prefObjectBase`/`prefVariantOf`; not run)
- severity: low

## `MARKED` is documented as `selection.css`'s selector but disagrees with it on fragments
- where: packages/ui/src/components/Prefs/selection.ts:17 vs packages/ui/src/components/Prefs/selection.css:5-7
- scenario: a group with `as: 'fragment'` is selected. The CSS excludes the fragment element and marks its child rows (`[data-pref-fragment][data-selected] > [data-pref-path]`). `MARKED` matches the fragment element, which uses `display: contents` and draws no mark, and none of its rows. `MARKED` is exported for tests (`ui/src/testing/prefs.ts`), so tests get the wrong elements.
- evidence: read
- severity: low

## Cmd-toggling the lead row off scrolls the form mid-click
- where: packages/ui/src/components/Prefs/selection.ts:129-133 (useSelectedRow)
- scenario: the selection is `[a, b]` and the reader Cmd-clicks `b` to drop it. That sets `reported = 'b'`, and the new lead is `a`. The effect then computes `pending = 'a' !== 'b'`, which is true, so the form smooth-scrolls `a` into view under the pointer. That is the case the code's comment says it must not do. The check compares the new lead with the pressed path instead of asking whether the change came from a report.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Prefs/UnionPicker.module.css
packages/ui/src/components/Prefs/UnionPicker.stories.tsx
packages/ui/src/components/Prefs/UnionPicker.tsx
packages/ui/src/components/Prefs/actionShortcutText.ts
packages/ui/src/components/Prefs/commitPolicy.ts
packages/ui/src/components/Prefs/compound.ts
packages/ui/src/components/Prefs/drop.ts
packages/ui/src/components/Prefs/dropMotion.ts
packages/ui/src/components/Prefs/dropTarget.ts
packages/ui/src/components/Prefs/entry.ts
packages/ui/src/components/Prefs/fragment.module.css
packages/ui/src/components/Prefs/frames.tsx
packages/ui/src/components/Prefs/groupHeading.tsx
packages/ui/src/components/Prefs/hidden.module.css
packages/ui/src/components/Prefs/hidden.tsx
packages/ui/src/components/Prefs/index.ts
packages/ui/src/components/Prefs/leafAtValues.ts
packages/ui/src/components/Prefs/leafField.ts
packages/ui/src/components/Prefs/objectFieldContext.ts
packages/ui/src/components/Prefs/objectRows.tsx
packages/ui/src/components/Prefs/offTitle.module.css
packages/ui/src/components/Prefs/offTitle.tsx
packages/ui/src/components/Prefs/prefField.tsx
packages/ui/src/components/Prefs/prefLeaf.story.tsx
packages/ui/src/components/Prefs/prefNumberScale.ts
packages/ui/src/components/Prefs/registeredActions.ts
packages/ui/src/components/Prefs/renderContext.ts
packages/ui/src/components/Prefs/renderLeaf.tsx
packages/ui/src/components/Prefs/reset.tsx
packages/ui/src/components/Prefs/schema.ts
packages/ui/src/components/Prefs/scrollbar.ts
packages/ui/src/components/Prefs/selection.css
packages/ui/src/components/Prefs/selection.ts
packages/ui/src/components/Prefs/splitRows.ts
packages/ui/src/components/Prefs/stuckHeading.ts
packages/ui/src/components/Prefs/surfaceControls.ts
packages/ui/src/components/Prefs/unmatchedRenderers.ts
packages/ui/src/components/Prefs/useLeafAction.tsx
packages/ui/src/components/Prefs/useParamsPolicy.ts

<!-- done: 6 findings, files read: 39 -->