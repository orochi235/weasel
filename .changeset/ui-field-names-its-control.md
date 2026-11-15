---
'@weasel-js/ui': major
---

A `Field`'s label names the one control inside it, and its new `description` and `error` describe it; a field of several controls takes `group`.

Without `group` the field is no longer a `role="group"`: the control takes the label as its accessible name, so it no longer repeats the label in an `aria-label`. With `group` the field is a group its label names, its `description` and `error` describe the group, and each control names itself.

```tsx
// before
<Field label="Opacity"><Slider aria-label="Opacity" … /></Field>
<Field label="Size"><UnitField aria-label="Width" … /><UnitField aria-label="Height" … /></Field>
// after
<Field label="Opacity" description="Of the whole layer."><Slider … /></Field>
<Field label="Size" group><UnitField aria-label="Width" … /><UnitField aria-label="Height" … /></Field>
```

<!-- entry: rank=10 breaking api new -->
