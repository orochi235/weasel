---
'@weasel-js/text-tools': major
---

`TEXT_TOOLS` has the id `'text'`, and the text and sticky tools sit in the `text` palette group, matching the `tools:text` preset.

Both were `'type'`, and the set's label is "Text".

```tsx
// before
<ToolPalette tools={tools} groupOrder={['select', 'view', 'shape', 'type']} />
// after
<ToolPalette tools={tools} groupOrder={['select', 'view', 'shape', 'text']} />
```

<!-- entry: breaking api -->
