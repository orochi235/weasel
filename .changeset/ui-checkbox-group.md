---
'@weasel-js/ui': minor
---

`CheckboxGroup`: a list of checkboxes or switches over one selection, with Alt-click solo and an optional sweep.

It takes `items` (`value`, `label`, `ariaLabel`, `disabled`), `value` and `onChange` as the list of values that are on, `mixedValues`, `control` (`'checkbox'`, the default, or `'switch'`), and `orientation` (`'vertical'`, the default, or `'horizontal'`, which wraps). Alt-clicking a box, or Alt+Space, turns it on and every other one off, and a second Alt-click turns them all back on. With `sweep`, a drag sets every box it reaches to what the press set the first, and an Alt-drag solos the boxes it reaches.

```tsx
<CheckboxGroup aria-label="Overlays" sweep items={items} value={on} onChange={setOn} />
```

<!-- entry: rank=5 new api -->
