---
'@weasel-js/ui': patch
---

`Checkbox` now draws its box from a native `<input type="checkbox">`, skinned by the same stylesheet as `PropertyField`'s checkbox rows, instead of a React Aria checkbox with a painted `<span>`. It keeps the props callers use (`isSelected`, `defaultSelected`, `onChange`, `isIndeterminate`, `isDisabled`, `isReadOnly`, `isInvalid`, `isRequired`, `name`, `value`, `id`, `aria-*`), but no longer accepts React Aria-only ones such as `validate`, `slot` or `inputRef`. The property-row checkmark now matches `Checkbox`'s, a slightly thinner stroke than before, and an invalid box shows the danger border in both places.
