---
'@weasel-js/routing': patch
'@weasel-js/cursor': patch
'@weasel-js/modes': patch
'@weasel-js/registry': patch
---

Fixes to the last operation, tunings, held previews, merged menus, tool options, scratch keys, `freshId`, cursor sizes and the scoping dim.

- Adjusting the last operation after its action was unregistered, or while its `enabled` refuses, leaves the operation, the history and the selection as they were, and `adjust` returns `false`. Before, it undid the operation and put nothing in its place.
- A tuning's params reach an action that declares a `params` form as the registry lists it, so `invokedParams` names them and a variant's shortcut chip shows for a binding that fires the variant through the tuning.
- A held tool option that is NaN or infinite reads as its default, so the bracket keys step it again instead of leaving it NaN. An option named like an `Object.prototype` member (`toString`) reads its default.
- `getScratch` reads a key named like an `Object.prototype` member as unset until it is written, instead of handing back the prototype's function.
- A cursor glyph whose `size` or `worldRadius` is NaN, infinite, zero or negative draws at the default size, instead of baking `NaN` into its image, which the browser drops.
- `createScopingDim` holds `dimAlpha` to [0, 1] and reads NaN as `OUT_OF_SCOPE_ALPHA`.
- An action held through `holdPreview` asks its `enabled` again at the release, and runs nothing when it now refuses; the preview still comes down.
- `freshId` numbers from 1 when `from` is NaN or infinite. Before, a NaN `from` looped forever when `base-NaN` was taken.
- Two menu contributions sharing a key no longer overwrite a key already spelled `key~n`: the second takes the next free `~n`.
