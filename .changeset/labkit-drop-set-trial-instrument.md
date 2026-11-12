---
'@weasel-js/labkit': major
---

The lab store's `setTrialInstrument` is gone; `swapTrial` is how a trial changes instrument.

It handed the new instrument the old one's state, config, view and undo under the same id. `swapTrial` opens a fresh trial in its place with a new id.

```ts
// before
store.getState().setTrialInstrument(id, 'Spectrometer');
// after
useLabCommands().swapTrial(id, 'Spectrometer');
```

<!-- entry: breaking -->
