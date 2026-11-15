---
'@weasel-js/ui': major
---

`Checkbox` and `Switch` forward `ref` to their `<input>`, the element focus goes to; the new `rootRef` reaches the `<label>` around it.

```tsx
// before: a ref to the label
<Checkbox ref={labelRef}>Snap</Checkbox>
// after
<Checkbox ref={inputRef} rootRef={labelRef}>Snap</Checkbox>
```

<!-- entry: breaking api -->
