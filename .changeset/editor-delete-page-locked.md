---
"@weasel-js/editor": minor
---

Delete Page is disabled while the page holds a locked item, instead of throwing, and `DocPages.removable(id)` says so.

`removable` answers `true`, `ActionDisabledReason.NotApplicable` for the last page or one the scene lacks, or `ActionDisabledReason.Locked`; `remove` does nothing where it says no. Use it as a Delete Page command's `enabled`:

```ts
useCommand('page.delete', 'Delete Page', () => pages.remove(id), { enabled: () => pages.removable(id) });
```

<!-- entry: api fix -->
