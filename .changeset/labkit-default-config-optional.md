---
'@weasel-js/labkit': major
---

An instrument with no settings no longer writes `defaultConfig: () => ({})`: `defaultConfig` is optional on every instrument.

A trial starts from the instrument's `defaultConfig`, else its `config` schema's defaults, else `{}`. `defaultConfigOf(instrument)` reads it that way; call it where code called `instrument.defaultConfig()`, which may now be absent. `defineInstrument` returns its spec unchanged, and the `InstrumentSpec` type is gone: write `Instrument`.

```ts
// before
const counter = defineInstrument({ name: 'Counter', defaultConfig: () => ({}), initialState: () => 0, render });
const start = counter.defaultConfig();
// after
const counter = defineInstrument({ name: 'Counter', initialState: () => 0, render });
const start = defaultConfigOf(counter);
```

<!-- entry: breaking api -->
