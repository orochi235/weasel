---
'@weasel-js/ui': major
---

`Select` no longer takes React Aria's `value`, `defaultValue`, `onChange` and `selectionMode`, which overrode its own selection. They skipped its read-only and disabled handling.

Use the props `Select` documents instead:

```tsx
// before
<Select value={key} onChange={setKey} options={options} />
// after
<Select selectedKey={key} onSelectionChange={setKey} options={options} />
```

<!-- entry: breaking fix -->
