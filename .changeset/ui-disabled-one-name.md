---
'@weasel-js/ui': major
---

Every kit component says `disabled` and `readOnly`, never React Aria's `isDisabled` and `isReadOnly`.

`Checkbox`, `Switch`, `RadioGroup`, `Radio`, `Input`, `TextArea`, `NumberField`, `Select`, `SelectItem`, `ComboBox`, `ComboBoxItem`, `Tabs`, `Tab`, `FontFamilySelect`, and `FontWeightSelect` are renamed; each translates them for React Aria itself. `PrefsForm`'s set of paths to disable is now `disabledPaths`, since `disabled` disables the whole form.

```tsx
// before
<Switch isDisabled={!ready}>Snap</Switch>
<Checkbox isReadOnly>Locked</Checkbox>
<PrefsForm schema={schema} disabled={new Set(['view.lift'])} onChange={write} />
// after
<Switch disabled={!ready}>Snap</Switch>
<Checkbox readOnly>Locked</Checkbox>
<PrefsForm schema={schema} disabledPaths={new Set(['view.lift'])} onChange={write} />
```

<!-- entry: rank=10 breaking api -->
