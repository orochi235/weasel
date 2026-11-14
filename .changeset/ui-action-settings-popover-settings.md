---
'@weasel-js/ui': major
---

`ActionSettingsPopover` takes its settings form as `settings`, where it took `form`.

`form` is now the `ControlForm` its button draws in.

```tsx
// before
<ActionSettingsPopover form={settings} label="Snap" />
// after
<ActionSettingsPopover settings={settings} label="Snap" />
```

<!-- entry: breaking api -->
