---
'@weasel-js/ui': major
---

`Select`'s `id` and `ref` reach its trigger `<button>`, the element a `<label htmlFor>` names and focus goes to; `triggerId` is gone.

```tsx
// before
<Select triggerId="mode" … />
// after
<Select id="mode" ref={triggerRef} … />
```

<!-- entry: breaking api -->
