---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

Every `@weasel-js/ui` component names itself through `aria-label`, as `MenuButton` and the DOM do, in place of `ariaLabel`.

The components that took `ariaLabel` are `Button`, `Slider`, `Sidebar`, `ToolPalette`, `ToolGroup`, `ColorModeControl`, `EffectList`, `ResizeHandle` and `PrefsRail`; `SegmentedBar` and `CycleButton`, which replace `ToggleBar`, `ButtonBar`, `OptionsBar` and `ThemeSwitcher`, take `aria-label` too. A row or segment in a data list (`SegmentedBarItem`, `DetentItem`) keeps its `ariaLabel` field.

```tsx
// before
<Button iconOnly ariaLabel="Add"><Icon name="core:plus" /></Button>
<Slider ariaLabel="Opacity" thumbs={thumbs} onInput={setThumbs} />
// after
<Button iconOnly aria-label="Add"><Icon name="core:plus" /></Button>
<Slider aria-label="Opacity" thumbs={thumbs} onInput={setThumbs} />
```

<!-- entry: breaking api -->
