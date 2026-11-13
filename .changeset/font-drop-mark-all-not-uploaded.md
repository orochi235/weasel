---
'@weasel-js/font': major
---

`markAllFontsNotUploaded` is gone from `@weasel-js/font`; it had done nothing since each texture cache started deduplicating its own uploads.

Delete the call. A renderer restoring a lost context re-uploads atlases through its new texture cache without it.

```ts
// before
markAllFontsNotUploaded();
// after: nothing
```

<!-- entry: breaking -->
