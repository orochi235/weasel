---
'@weasel-js/ui': major
---

`FillStrokeSwatch` takes `target` and `onTargetChange`, where it took `focused` and `onFocusChange`.

They pick the slot that edits land on. The chip that holds it carries `data-target` in place of `data-focused`.

```tsx
// before
<FillStrokeSwatch fill={fill} stroke={stroke} focused={slot} onFocusChange={setSlot} onChange={apply} />
// after
<FillStrokeSwatch fill={fill} stroke={stroke} target={slot} onTargetChange={setSlot} onChange={apply} />
```

<!-- entry: breaking api -->
