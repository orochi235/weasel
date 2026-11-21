# Audit round 59 — ui.components.Prefs.part2

## An object leaf's fields ignore the leaf's own `disabled` whenever `disabledAt` is given, so a disabled alias of an object edits freely
- where: packages/ui/src/components/Prefs/objectFieldContext.ts:67 (objectFieldContext, `disabled:`)
- scenario: `disabled: ctx.disabledAt ? ctx.disabledAt(path) : ctx.disabled === true` drops `ctx.disabled` whenever a `disabledAt` exists. For an alias row, `prefRenderContext` (PrefsRow.tsx:160–162) sets `disabled` from the form's set at the alias's *own* path but `disabledAt` from `ctx.targets.disabledAt`, which answers by the *target* schema. So an alias of an `object` leaf, placed in a group whose `enableIf` fails (or carrying a failing `enableIf` of its own), draws a disabled row whose fields each ask `targets.disabledAt('<target>.<field>')` → false and stay editable. They should be disabled, since the leaf they hang off is. The same OR is missing for an entry drawn through `entryConditions`, whose `disabledAt` does not fold in `ctx.disabled`. `hidden` on the next lines does OR `ctx.hidden` in, so the two flags are answered differently. ObjectLeaf.tsx:37 (`off`) repeats the same expression for section names.
- evidence: read (inferred from the code paths; not run)
- severity: medium

## `warnUnmatchedRenderers` treats a section's key as a path segment and warns about a renderer keyed by the field's real path
- where: packages/ui/src/components/Prefs/unmatchedRenderers.ts:16 (pathsAndKinds)
- scenario: the walk adds `${path}.${key}` for `members` exactly as it does for `children`. A `PrefSection`'s key is not a segment of its leaves' paths (schema.ts:prefFieldChoices says so, `prefSectionLeaves` flattens it, and objectFieldContext builds `${ctx.path}.${key}` from the leaf key). Take an object leaf `stroke` with a section `look: { members: { width } }`. The field draws at `stroke.width`, and `renderNestedLeaf` looks a renderer up by that path. The walk records only `stroke.look.width`, so `renderers={{ 'stroke.width': … }}` gets a dev warning that it "draws nothing" although it does draw, and `'stroke.look.width'`, which never matches, gets no warning. The same applies to a section-rooted `over` (`walk(over, '')` on `members`).
- evidence: read
- severity: low

## A nested section inside an object's `bar` section is keyed `${objectPath}.${key}`, which ignores its depth and the `#` section-path form
- where: packages/ui/src/components/Prefs/objectRows.tsx:142 (barNodes)
- scenario: `drawnChildren` names sections by `prefSectionPath(within, key)` (`obj.#a.#b`), but `barNodes` names every nested run `${parts.path}.${key}` whatever section it sits under. `barNodeChildren` uses `run.path` as the dividers' React keys (`${path}:before` / `:after`) and as the `in` container of the run's `BarItem`s. Take a bar section whose members are a section `x` and another section that itself holds a section `x`. Both runs get the path `obj.x`, so React sees duplicate keys and the bar's items in both runs report one container, which breaks `onReorder`. A section key that equals a field key also makes the container read as that field's path.
- evidence: read
- severity: low

## The union variant select offers an "Unset" choice that does nothing
- where: packages/ui/src/components/Prefs/UnionPicker.tsx:28 (UnionPicker, `clearable: true`) and :39 (`setValue`)
- scenario: the synthetic enum is `clearable: true`, so `enumFieldProps` gives it `onClear: () => setValue(undefined)`, and `EnumControl` adds an "Unset" option (EnumControl.tsx:24). The `setValue` it passes ignores anything that is not a string, so picking "Unset" writes nothing, and the controlled select snaps back to the variant. It should either clear the union's value or not offer the option.
- evidence: read
- severity: low

## `MARKED` and `selection.css` disagree about selected fragments, though the comment says they are the same selector
- where: packages/ui/src/components/Prefs/selection.ts:17 (MARKED) vs packages/ui/src/components/Prefs/selection.css:5–7
- scenario: the stylesheet excludes `[data-pref-fragment]` from the mark and draws it on the fragment's child rows (`[data-pref-fragment][data-selected] > [data-pref-path]`). `MARKED`, which `@weasel-js/ui/testing` re-exports for tests to find what is drawn marked, still matches the fragment element and none of its rows. Selecting an `as: 'fragment'` group therefore makes `querySelectorAll(MARKED)` return an element with no visible mark, and miss the rows that carry one.
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

<!-- done: 5 findings, files read: 39 -->
