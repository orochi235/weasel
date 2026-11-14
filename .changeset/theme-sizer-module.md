---
'@weasel-js/theme': minor
---

`@weasel-js/theme/sizer.module.css` holds a box at the width of the widest of several strings.

It keeps a readout from reflowing as its value changes. Put each candidate in a `sizer` child, set in the same grid cell as the visible value.

```css
.readout { display: inline-grid; }
.readout > * { grid-area: 1 / 1; }
.sizer { composes: sizer from '@weasel-js/theme/sizer.module.css'; }
```

<!-- entry: api -->
