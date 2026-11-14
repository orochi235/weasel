---
'@weasel-js/ui': major
---

`CurvedLabel` lies along the `Along` it sits in and no longer takes `arc`, `shape` or `align`; outside an `Along` it is a plain line of text.

```tsx
// before
<CurvedLabel text="Zoom" arc={{ start: 270, end: 90 }} align="start" />
// after
<Along arc={{ start: 270, end: 90 }} align="start">
  <CurvedLabel text="Zoom" />
</Along>
```

<!-- entry: breaking api -->
