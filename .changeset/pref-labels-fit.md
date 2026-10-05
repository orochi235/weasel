---
'@weasel-js/core': minor
'@weasel-js/ui': patch
---

A pref's label shortens to fit the room it is given. **Breaking:** `short` on a pref leaf and on an enum option is now a list of shorter forms, longest first (`short: ['Track', 'VA']`), where it was one string; wrap an existing value in an array. A toggle segment, a flag bar, and a `ToolOptionsBar` label show the longest form that fits, stepping every label in the bar down together, and `name` stays the accessible name. A leaf's `icon` is still drawn in place of any text form where it resolves; a flag with neither no longer falls back to its name's first letter.

The mechanism is public: `useFitScope(ref)` measures an element and its parent for overflow, `<FitScope>` hands the step to the `<FitLabel forms>` beneath it, and `ToggleBar` is a scope on its own. `PropertyOption` and `PropertyBooleanFieldProps` take `short` beside `glyph`, which now means only a drawn glyph.

<!-- bump-approved: minor: maintainer — minor release requested 2026-10-05 -->
