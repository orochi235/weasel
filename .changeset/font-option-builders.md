---
'@weasel-js/ui': major
---

`FontFamilySelect` and `FontWeightSelect` are gone; a `Select` takes its options from `useFontFamilyOptions` and `useFontWeightOptions`.

The hooks build the same lists the components did, including a value the registry can't offer kept as its own entry ("Inter — not loaded, showing sans-serif"), and rebuild when a face is registered or finishes loading. `fontFamilyOptions` and `fontWeightOptions` are the same builders without the subscription. All four, and `fontWeightLabel`, come from `@weasel-js/ui/components/FontOptions`. Weight options are keyed by the weight as a string.

```tsx
// before
<FontWeightSelect family={family} value={weight} onChange={setWeight} />
// after
const options = useFontWeightOptions({ family, value: weight });
<Select<string>
  aria-label="Weight"
  options={options}
  selectedKey={String(weight)}
  onSelectionChange={(key) => setWeight(Number(key))}
/>
```

<!-- entry: breaking api -->
