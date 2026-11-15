---
'@weasel-js/ui': major
---

A property slider's and a color field's `onChange` always commits once per edit, so a commit-only caller no longer passes a no-op `onInput`.

Before, either field's `onChange` fired on every move when no `onInput` was given. A caller that wants live values now passes `onInput` too. `withCommitPolicy` settles a field by dropping its `onInput`, and leaves a live one writing through both. A text field takes `onCancel`, fired after Escape drops its draft.

```tsx
// before: live
<PropertyField kind="number" control="slider" label="Size" value={size} onChange={setSize} />
// after
<PropertyField kind="number" control="slider" label="Size" value={size} onInput={setSize} onChange={setSize} />
```

<!-- entry: rank=5 breaking api behavior -->
