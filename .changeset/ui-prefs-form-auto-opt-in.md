---
'@weasel-js/ui': major
---

`PrefsForm` and `PrefsDialog` offer the Auto toggle only on a leaf whose schema declares `auto`, so an ordinary setting gets Reset alone.

`canInherit` now narrows the leaves that declare `auto`; it can no longer give a leaf without one a toggle.

```ts
// Before: any leaf got the toggle once onAutoChange was given
{ kind: 'number', name: 'Glow', description: '', default: 2 }

// After: opt the leaf in
{ kind: 'number', name: 'Glow', description: '', default: 2, auto: {} }
```

<!-- entry: rank=5 breaking behavior visual -->
