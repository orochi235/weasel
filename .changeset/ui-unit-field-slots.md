---
'@weasel-js/ui': minor
---

`UnitField` takes the label, description and error slots `NumberField` has, and submits with a form under a `name`.

New props: `label`, `orientation`, `description`, `errorMessage` (shown while `isInvalid`), `isInvalid`, `isRequired`, `name`, `onFocus`, `onBlur`, `autoFocus`, `aria-labelledby`, `aria-describedby`, and a `ref` to its `<input>`. `name` submits the value as a plain number in the unit the field shows; `onBlur` is called after the field has committed what was typed.

<!-- entry: api new -->
