---
'@weasel-js/ui': major
---

`Dialog` takes `dismissable` and `keyboardDismissDisabled`, where it passed React Aria's `isDismissable` and `isKeyboardDismissDisabled` through.

```tsx
// before
<Dialog open={open} onOpenChange={setOpen} isDismissable title="Commands" />
// after
<Dialog open={open} onOpenChange={setOpen} dismissable title="Commands" />
```

<!-- entry: breaking api -->
