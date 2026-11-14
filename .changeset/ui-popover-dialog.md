---
'@weasel-js/ui': minor
---

`PopoverDialog` is React Aria's `Dialog` wearing ui's popover surface, the body for a `<Popover>` that holds a form or a panel.

Every ui popover with a dialog inside now draws its border, background, and shadow through it.

```tsx
<Popover>
  <PopoverDialog aria-label="Stroke" className={styles.body}>…</PopoverDialog>
</Popover>
```

<!-- entry: api -->
