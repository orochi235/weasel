---
'@weasel-js/core': patch
---

Key `usePublishSelection` on the publish callback, not the context value

The effect depended on the whole selection-context value, and the provider
mints a new value object on every publish. So one publisher publishing refired
the effect for every other publisher in scope, each of which republished its
own ids — a newer selection got stomped back to an older one, and two
publishers holding different ids under one provider never settled at all.

`publishSelection` is already a stable `useCallback`, so the effect now depends
on it directly. No provider change and no API change.
