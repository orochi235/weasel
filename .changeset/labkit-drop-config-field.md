---
'@weasel-js/labkit': major
---

An instrument declares its settings with `config: f.schema({ … })` only: the `ConfigField[]` form is gone.

`Instrument.configSchema`, `<ControlPanel fields>`, the chrome context's `configFields`, `fromConfigFields`, `validateConfigSchema`, `ValidationResult` and the `ConfigField` types (`SliderField`, `CheckboxField`, `SelectField`, `NumberField`, `TextField`, `ColorField`, `SelectOption`, `ConfigFieldType`) are removed. `<ControlPanel schema>` is now required. An instrument with no `config` has no settings panel.

```ts
// before
defineInstrument({
  defaultConfig: () => ({ width: 18 }),
  configSchema: () => [{ key: 'width', label: 'Width', type: 'slider', min: 1, max: 48, default: 18 }],
  // …
});
// after
defineInstrument({
  config: f.schema({ width: f.number(18).range(1, 48) }),
  // …
});
```

<!-- entry: rank=10 breaking -->
