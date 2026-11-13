---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

Every `@weasel-js/ui` component names itself through `aria-label`, as `MenuButton` and the DOM do, in place of `ariaLabel`.

The components that took `ariaLabel` were `Button`, `CloseButton`, `ToggleBar`, `ButtonBar`, `OptionsBar`, `Slider`, `DetentSlider`, `Sidebar`, `StatusBar`, `ToolPalette`, `ToolGroup`, `ThemeSwitcher`, `ColorModeControl`, `EffectList`, `ResizeHandle` and `PrefsRail`. A row or segment in a data list (`ToggleBarItem`, `ButtonBarItem`, `DetentItem`) keeps its `ariaLabel` field.

```tsx
// before
<Button iconOnly ariaLabel="Add"><Icon name="core:plus" /></Button>
<ToggleBar ariaLabel="Align" items={items} value={v} onChange={setV} />
// after
<Button iconOnly aria-label="Add"><Icon name="core:plus" /></Button>
<ToggleBar aria-label="Align" items={items} value={v} onChange={setV} />
```

<!-- entry: breaking api -->
