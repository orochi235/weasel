---
'@weasel-js/ui': major
---

`ThemeSwitcher` is `CycleButton`, and it takes the list it cycles and its name from you.

It is imported from `@weasel-js/ui/components/CycleButton`. `options` and `aria-label` are required, so nothing defaults to the color modes or to the name "Theme"; `COLOR_MODE_OPTIONS` is still the color-mode list. `ThemeSwitcherOption` and `ThemeSwitcherProps` are `CycleButtonOption` and `CycleButtonProps`.

```tsx
// before
<ThemeSwitcher value={preference} onChange={setPreference} />
// after
<CycleButton value={preference} onChange={setPreference} options={COLOR_MODE_OPTIONS} aria-label="Theme" />
```

<!-- entry: rank=5 breaking api -->
