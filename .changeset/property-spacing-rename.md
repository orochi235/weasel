---
'@weasel-js/ui': major
---

A property panel's room is `spacing="tight" | "normal" | "loose"`, not `density`, so `roomy` means only the theme's density.

Every `Properties` container (`PropertyPanel`, `PropertyList`, `PropertyGroup`, `PropertyRow`, `PropertyField`, `Subpanel`, `DialogRow`) takes `spacing` in place of `density`, and the type `PropertyDensity` is `PropertySpacing`. What each value does is unchanged.

```tsx
// before
<PropertyPanel density="roomy">…</PropertyPanel>
// after
<PropertyPanel spacing="loose">…</PropertyPanel>
```

<!-- entry: breaking api -->
