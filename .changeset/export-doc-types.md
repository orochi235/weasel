---
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/storage': patch
---

Types that documented exports already named are now exported, so they can be imported and the API reference can link them. Additive: `OpsApplier` from core (the `adapter` argument of `useSliceDepSource`), `OnTokenChange` and `Key` from ui (`Key` is what an option's `value` may be in `Select`, `ComboBox`, and `useAsyncOptions`), `LabBaseProps` from labkit, and `CreateRecordCacheOptions` from storage (the argument of `createRecordCache`).
