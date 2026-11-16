---
'@weasel-js/ui': minor
---

`ToggleChips`: a wrapping set of toggle chips, each drawing any content (a `Badge`, say), with `SegmentedBar`'s multiple selection and sweep.

It takes `items` (`value`, `label`, and the usual tooltip and disabled fields), `value` and `onChange` as a list of the values that are on, and `mixedValues`, `disabled` and `readOnly`. A chip that is off draws dimmed. The arrows move focus and Space or Enter flips the focused chip; with `sweep`, a drag sets every chip it reaches to what the press set the first one to, across lines.

```tsx
<ToggleChips aria-label="Packages" sweep items={items} value={on} onChange={setOn} />
```

<!-- entry: rank=5 new api -->
